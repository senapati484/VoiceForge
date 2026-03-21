import type { Request, Response } from 'express';
import { config } from '../../config';

/**
 * Vapi Tools Handler
 * Handles custom tool/function calls from Vapi
 * Docs: https://docs.vapi.ai/tools/custom-tools
 *
 * Tools defined here should be registered in your Vapi assistant config
 */

// Tool definitions that should match your Vapi assistant configuration
export const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'getCurrentTime',
      description: 'Get the current time and date',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'lookupCustomer',
      description: 'Look up customer information by phone number',
      parameters: {
        type: 'object',
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'The phone number to look up'
          }
        },
        required: ['phoneNumber']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'bookAppointment',
      description: 'Book an appointment for the customer',
      parameters: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date in YYYY-MM-DD format'
          },
          time: {
            type: 'string',
            description: 'Time in HH:MM format'
          },
          service: {
            type: 'string',
            description: 'Type of service'
          },
          customerName: {
            type: 'string',
            description: 'Customer name'
          }
        },
        required: ['date', 'time', 'service', 'customerName']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'sendSMS',
      description: 'Send an SMS message to a phone number',
      parameters: {
        type: 'object',
        properties: {
          phoneNumber: {
            type: 'string',
            description: 'Phone number to send SMS to'
          },
          message: {
            type: 'string',
            description: 'Message content'
          }
        },
        required: ['phoneNumber', 'message']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'transferToHuman',
      description: 'Transfer the call to a human agent',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Reason for transfer'
          }
        },
        required: ['reason']
      }
    }
  }
];

/**
 * Handle tool execution requests
 * This can be used as a separate endpoint or called from webhook
 */
export async function handleToolRequest(req: Request, res: Response): Promise<void> {
  try {
    const { name, parameters, call } = req.body;

    console.log(`[Vapi Tool] Executing: ${name}`, parameters);

    const result = await executeTool(name, parameters, call);

    res.json({
      success: true,
      result
    });
  } catch (err: any) {
    console.error('[Vapi Tool] Error:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Tool execution failed'
    });
  }
}

/**
 * Get tool definitions
 * Use this to configure your Vapi assistant tools
 */
export async function getToolDefinitions(req: Request, res: Response): Promise<void> {
  res.json({
    tools: TOOL_DEFINITIONS
  });
}

/**
 * Execute a tool by name
 */
async function executeTool(name: string, parameters: any, call?: any): Promise<any> {
  switch (name) {
    case 'getCurrentTime': {
      const now = new Date();
      return {
        time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        date: now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        timestamp: now.toISOString()
      };
    }

    case 'lookupCustomer': {
      const { phoneNumber } = parameters || {};
      // TODO: Integrate with your customer database
      // Example mock response:
      return {
        found: true,
        customer: {
          id: 'cust_123',
          name: 'John Doe',
          email: 'john@example.com',
          phoneNumber: phoneNumber,
          accountStatus: 'active',
          plan: 'premium',
          lastInteraction: '2024-01-15'
        },
        recentOrders: [
          { id: 'ord_456', date: '2024-01-10', total: 150.00, status: 'delivered' }
        ]
      };
    }

    case 'bookAppointment': {
      const { date, time, service, customerName } = parameters || {};
      // TODO: Integrate with your calendar/booking system
      const appointmentId = `appt_${Date.now()}`;
      return {
        success: true,
        appointmentId,
        confirmedDate: date,
        confirmedTime: time,
        service,
        customerName,
        status: 'confirmed',
        calendarLink: `https://calendar.example.com/${appointmentId}`
      };
    }

    case 'sendSMS': {
      const { phoneNumber, message } = parameters || {};
      // TODO: Integrate with Twilio or other SMS provider
      // Example:
      // await twilioClient.messages.create({
      //   to: phoneNumber,
      //   from: process.env.TWILIO_PHONE_NUMBER,
      //   body: message
      // });
      return {
        sent: true,
        to: phoneNumber,
        messageId: `msg_${Date.now()}`,
        status: 'queued',
        timestamp: new Date().toISOString()
      };
    }

    case 'transferToHuman': {
      const { reason } = parameters || {};
      return {
        transferred: true,
        reason,
        queuePosition: 1,
        estimatedWaitTime: '2 minutes',
        transferNumber: '+1-800-SUPPORT', // Or your actual support number
        note: 'Call transferred to human agent'
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
