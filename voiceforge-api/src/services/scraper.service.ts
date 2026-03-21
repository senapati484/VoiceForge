import * as cheerio from 'cheerio';
import { AppError } from '../middleware/errorHandler';

export async function scrapeUrl(url: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new AppError(`Failed to fetch URL: ${response.statusText}`, 422);
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove non-content elements
    $('script, style, nav, footer, header, iframe, aside, .ads, .advertisement').remove();

    // Extract text from main content areas
    let text = '';
    const contentSelectors = ['main', 'article', '[role="main"]', '.content', '#content', 'body'];

    for (const selector of contentSelectors) {
      const element = $(selector).first();
      if (element.length) {
        text = element.text();
        break;
      }
    }

    // Clean up whitespace
    text = text
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    // Limit to 50,000 characters
    return text.slice(0, 50000);
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError('Failed to scrape URL', 422);
  } finally {
    clearTimeout(timeout);
  }
}
