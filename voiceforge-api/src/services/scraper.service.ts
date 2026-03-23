import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import { AppError } from '../middleware/errorHandler';

export interface ScrapedContent {
  title: string;
  description: string;
  mainContent: string;
  sections: Array<{ heading: string; content: string }>;
  links: string[];
}

/**
 * Extract main content using readability-like heuristics
 */
function extractMainContent($: cheerio.CheerioAPI): { content: string; sections: Array<{ heading: string; content: string }> } {
  // Remove non-content elements
  $('script, style, nav, footer, header, iframe, aside, .ads, .advertisement, .cookie-banner, .newsletter, .social-share').remove();

  const sections: Array<{ heading: string; content: string }> = [];

  // Try to find the main content area
  const contentSelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '#content',
    '.main-content',
    '#main-content',
    '.post-content',
    '.entry-content',
    'article .entry-content',
    '.page-content',
    '[itemprop="articleBody"]',
    '.prose',
    '.markdown'
  ];

  let mainElement: cheerio.Cheerio<AnyNode> | null = null;
  let mainSelector = '';

  for (const selector of contentSelectors) {
    const element = $(selector).first();
    if (element.length && element.text().trim().length > 200) {
      mainElement = element;
      mainSelector = selector;
      break;
    }
  }

  // Fallback to body if no main content found
  if (!mainElement) {
    mainElement = $('body');
    mainSelector = 'body';
  }

  // Extract sections with headings
  const headings = mainElement.find('h1, h2, h3, h4, h5, h6');

  if (headings.length > 0) {
    headings.each((_: number, elem: AnyNode) => {
      const heading = $(elem).text().trim();
      let content = '';

      // Get content until next heading
      let nextElem = $(elem).next();
      while (nextElem.length && !nextElem.is('h1, h2, h3, h4, h5, h6')) {
        const text = nextElem.text().trim();
        if (text && text.length > 20) {
          content += text + '\n\n';
        }
        nextElem = nextElem.next();
      }

      if (heading && content.length > 50) {
        sections.push({ heading, content: content.trim() });
      }
    });
  }

  // If no sections found, extract paragraphs
  if (sections.length === 0) {
    const paragraphs: string[] = [];
    mainElement.find('p').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 30) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length > 0) {
      sections.push({
        heading: 'Content',
        content: paragraphs.join('\n\n')
      });
    }
  }

  // Get full text
  let content = mainElement.text();

  // Clean up whitespace
  content = content
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .replace(/\t+/g, ' ')
    .trim();

  return { content, sections };
}

/**
 * Scrape a URL and extract structured content
 */
export async function scrapeUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000); // 15 second timeout

  try {
    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new AppError('Invalid URL format. Please provide a valid URL including http:// or https://', 400);
    }

    // Only allow http and https
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new AppError('Only HTTP and HTTPS URLs are allowed', 400);
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'DNT': '1',
        'Connection': 'keep-alive',
      },
      signal: controller.signal,
      redirect: 'follow'
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 404) {
        throw new AppError('Page not found (404). Please check the URL and try again.', 404);
      }
      if (response.status === 403) {
        throw new AppError('Access denied (403). This website blocks automated access.', 403);
      }
      if (response.status >= 500) {
        throw new AppError('Server error on target website. Please try again later.', 502);
      }
      throw new AppError(`Failed to fetch URL: ${response.status} ${response.statusText}`, response.status);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new AppError(`Unsupported content type: ${contentType}. Only HTML pages can be scraped.`, 415);
    }

    const html = await response.text();

    if (!html || html.trim().length === 0) {
      throw new AppError('Page returned empty content', 422);
    }

    const $ = cheerio.load(html);

    // Extract metadata
    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Untitled';
    const description = $('meta[name="description"]').attr('content') ||
                       $('meta[property="og:description"]').attr('content') ||
                       $('meta[name="twitter:description"]').attr('content') ||
                       '';

    // Extract main content
    const { content: mainContent, sections } = extractMainContent($);

    if (!mainContent || mainContent.length < 100) {
      throw new AppError('Could not extract meaningful content from this page. It may require JavaScript or have anti-scraping protection.', 422);
    }

    // Build structured output
    const output: ScrapedContent = {
      title,
      description: description.slice(0, 500),
      mainContent: mainContent.slice(0, 10000), // Limit main content
      sections: sections.slice(0, 20), // Limit sections
      links: []
    };

    // Extract relevant links (limit to internal links and common doc patterns)
    const baseHostname = parsedUrl.hostname;
    $('a[href]').each((_: number, elem: AnyNode) => {
      const href = $(elem).attr('href');
      if (href) {
        try {
          const linkUrl = new URL(href, url);
          if (linkUrl.hostname === baseHostname && !href.startsWith('#')) {
            const linkText = $(elem).text().trim();
            if (linkText.length > 0) {
              output.links.push(`${linkText}: ${linkUrl.href}`);
            }
          }
        } catch {
          // Invalid URL, skip
        }
      }
    });

    // Build formatted text output
    const formattedParts: string[] = [];

    formattedParts.push(`# ${output.title}`);
    formattedParts.push('');

    if (output.description) {
      formattedParts.push(`## Description`);
      formattedParts.push(output.description);
      formattedParts.push('');
    }

    formattedParts.push(`## Content`);
    formattedParts.push(output.mainContent);
    formattedParts.push('');

    if (output.sections.length > 0) {
      formattedParts.push(`## Sections`);
      for (const section of output.sections) {
        formattedParts.push(`### ${section.heading}`);
        formattedParts.push(section.content);
        formattedParts.push('');
      }
    }

    if (output.links.length > 0) {
      formattedParts.push(`## Related Links`);
      formattedParts.push(output.links.slice(0, 10).join('\n'));
    }

    // Final cleanup - ensure clean text
    const finalText = formattedParts
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')  // Remove excessive newlines
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // Remove control characters
      .trim();

    // Limit to 50,000 characters (reasonable limit for processing)
    return finalText.slice(0, 50000);

  } catch (err) {
    clearTimeout(timeout);

    if (err instanceof AppError) {
      throw err;
    }

    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new AppError('Request timed out. The website took too long to respond.', 408);
      }
      if (err.message.includes('fetch')) {
        throw new AppError(`Network error: Unable to reach ${url}. Please check your internet connection and the URL.`, 503);
      }
    }

    throw new AppError(`Failed to scrape URL: ${err instanceof Error ? err.message : 'Unknown error'}`, 422);
  }
}

/**
 * Scrape URL and return structured data
 */
export async function scrapeUrlStructured(url: string): Promise<ScrapedContent> {
  const text = await scrapeUrl(url);

  // Parse the formatted text back to structure
  const lines = text.split('\n');
  const result: ScrapedContent = {
    title: '',
    description: '',
    mainContent: '',
    sections: [],
    links: []
  };

  let currentSection: { heading: string; content: string } | null = null;
  let inSection = false;
  let inLinks = false;
  const contentParts: string[] = [];

  for (const line of lines) {
    if (line.startsWith('# ')) {
      result.title = line.slice(2).trim();
    } else if (line === '## Description') {
      inSection = false;
      inLinks = false;
    } else if (line === '## Content') {
      inSection = false;
      inLinks = false;
    } else if (line === '## Sections') {
      inSection = true;
      inLinks = false;
    } else if (line === '## Related Links') {
      inSection = false;
      inLinks = true;
    } else if (line.startsWith('### ') && inSection) {
      if (currentSection) {
        result.sections.push({ ...currentSection });
      }
      currentSection = { heading: line.slice(4).trim(), content: '' };
    } else if (inSection && currentSection) {
      currentSection.content += line + '\n';
    } else if (inLinks) {
      result.links.push(line);
    } else if (!inSection && !inLinks && line.trim()) {
      contentParts.push(line);
    }
  }

  if (currentSection) {
    result.sections.push(currentSection);
  }

  result.mainContent = contentParts.join('\n');

  return result;
}
