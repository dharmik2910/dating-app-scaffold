import { Injectable, Logger } from '@nestjs/common';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

@Injectable()
export class AwsSmsService {
  private readonly logger = new Logger(AwsSmsService.name);
  private snsClient: SNSClient | null = null;

  constructor() {
    // Default to ap-south-1 (Mumbai) or us-east-1 for AWS SNS SMS delivery
    const region = process.env.AWS_SNS_REGION || process.env.AWS_REGION || 'ap-south-1';
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

    if (accessKeyId && secretAccessKey) {
      this.snsClient = new SNSClient({
        region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
      this.logger.log(`AWS SNS SMS Client initialized in region ${region}`);
    } else {
      this.logger.warn('AWS credentials not found. SMS will run in log mode.');
    }
  }

  /**
   * Normalize phone number to international E.164 format (+91XXXXXXXXXX)
   */
  public normalizePhoneNumber(phone: string): string {
    const cleaned = phone.replace(/[^\d+]/g, '');
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    // If Indian 10-digit number without country code
    if (cleaned.length === 10) {
      return `+91${cleaned}`;
    }
    // If starts with 91 and has 12 digits
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      return `+${cleaned}`;
    }
    return `+${cleaned}`;
  }

  /**
   * Send transactional OTP SMS via AWS SNS / AWS End User Messaging SMS
   */
  async sendOtpSms(phoneNumber: string, otp: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const formattedPhone = this.normalizePhoneNumber(phoneNumber);
    const message = `Your Lovora verification code is ${otp}. Valid for 5 minutes. Do not share this OTP with anyone.`;

    this.logger.log(`Dispatching SMS OTP to ${formattedPhone}...`);

    if (!this.snsClient) {
      const errMsg = 'AWS credentials not configured in backend/.env';
      this.logger.error(errMsg);
      return { success: false, error: errMsg };
    }

    try {
      const messageAttributes: Record<string, any> = {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional',
        },
      };

      if (process.env.AWS_SNS_SENDER_ID) {
        messageAttributes['AWS.SNS.SMS.SenderID'] = {
          DataType: 'String',
          StringValue: process.env.AWS_SNS_SENDER_ID,
        };
      }

      const command = new PublishCommand({
        PhoneNumber: formattedPhone,
        Message: message,
        MessageAttributes: messageAttributes,
      });

      const response = await this.snsClient.send(command);
      this.logger.log(`AWS SNS SMS sent successfully to ${formattedPhone}, MessageId: ${response.MessageId}`);
      return { success: true, messageId: response.MessageId };
    } catch (err: any) {
      const errMsg = err.message || 'AWS SNS SMS failed';
      this.logger.error(`Failed to send SMS via AWS SNS to ${formattedPhone}: ${errMsg}`, err.stack);
      return { success: false, error: errMsg };
    }
  }
}

