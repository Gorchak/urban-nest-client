import { Injectable } from '@angular/core';
import { environment } from '../../../environments/environment';

type GooglePayEnvironment = 'TEST' | 'PRODUCTION';
type GooglePayCardNetwork = 'VISA' | 'MASTERCARD';
type GooglePayAuthMethod = 'PAN_ONLY' | 'CRYPTOGRAM_3DS';

interface GooglePayConfig {
  environment: GooglePayEnvironment;
  merchantId: string;
  merchantName: string;
  countryCode: string;
  currencyCode: string;
  allowedCardNetworks: string[];
  allowedAuthMethods: string[];
  gateway: string;
  gatewayMerchantId: string;
}

interface GooglePayButtonOptions {
  onClick: () => void;
  buttonColor?: 'default' | 'black' | 'white';
  buttonType?: 'buy' | 'plain' | 'checkout' | 'order' | 'pay';
  buttonLocale?: string;
}

interface GooglePayCardPaymentMethod {
  type: 'CARD';
  parameters: {
    allowedAuthMethods: GooglePayAuthMethod[];
    allowedCardNetworks: GooglePayCardNetwork[];
  };
  tokenizationSpecification?: {
    type: 'PAYMENT_GATEWAY';
    parameters: {
      gateway: string;
      gatewayMerchantId: string;
    };
  };
}

interface GooglePayPaymentsClient {
  isReadyToPay(request: unknown): Promise<{ result: boolean }>;
  loadPaymentData(request: unknown): Promise<any>;
  createButton(options: GooglePayButtonOptions): HTMLElement;
}

export interface GooglePayPaymentResult {
  apiVersion: number;
  apiVersionMinor: number;
  description: string;
  paymentMethodType: string;
  token: string;
  tokenizationType: string;
  cardNetwork: string | null;
  cardDetails: string | null;
}

declare global {
  interface Window {
    google?: {
      payments?: {
        api?: {
          PaymentsClient: new (options: { environment: GooglePayEnvironment }) => GooglePayPaymentsClient;
        };
      };
    };
  }
}

@Injectable({ providedIn: 'root' })
export class GooglePayService {
  private readonly config = environment.googlePay as GooglePayConfig;
  private scriptPromise: Promise<void> | null = null;
  private client: GooglePayPaymentsClient | null = null;

  isConfigured(): boolean {
    return Boolean(
      this.config?.merchantId &&
      this.config?.merchantName &&
      this.config?.gateway &&
      this.config?.gatewayMerchantId,
    );
  }

  async isReadyToPay(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    const client = await this.getClient();
    const response = await client.isReadyToPay({
      ...this.baseRequest(),
      allowedPaymentMethods: [this.baseCardPaymentMethod()],
    });
    return Boolean(response.result);
  }

  async createButton(onClick: () => void): Promise<HTMLElement> {
    const client = await this.getClient();
    return client.createButton({
      onClick,
      buttonColor: 'black',
      buttonType: 'pay',
      buttonLocale: 'uk',
    });
  }

  async loadPaymentData(totalPrice: number): Promise<GooglePayPaymentResult> {
    const client = await this.getClient();
    const paymentData = await client.loadPaymentData({
      ...this.baseRequest(),
      allowedPaymentMethods: [this.cardPaymentMethod()],
      transactionInfo: {
        countryCode: this.config.countryCode,
        currencyCode: this.config.currencyCode,
        totalPriceStatus: 'FINAL',
        totalPrice: Math.max(0, totalPrice).toFixed(2),
      },
      merchantInfo: {
        merchantId: this.config.merchantId,
        merchantName: this.config.merchantName,
      },
    });

    const paymentMethodData = paymentData?.paymentMethodData;
    const tokenizationData = paymentMethodData?.tokenizationData;
    return {
      apiVersion: Number(paymentData?.apiVersion) || 2,
      apiVersionMinor: Number(paymentData?.apiVersionMinor) || 0,
      description: paymentMethodData?.description || '',
      paymentMethodType: paymentMethodData?.type || 'CARD',
      token: tokenizationData?.token || '',
      tokenizationType: tokenizationData?.type || '',
      cardNetwork: paymentMethodData?.info?.cardNetwork || null,
      cardDetails: paymentMethodData?.info?.cardDetails || null,
    };
  }

  private async getClient(): Promise<GooglePayPaymentsClient> {
    await this.loadScript();
    const Client = window.google?.payments?.api?.PaymentsClient;
    if (!Client) throw new Error('Google Pay API is unavailable');
    this.client ??= new Client({ environment: this.config.environment });
    return this.client;
  }

  private loadScript(): Promise<void> {
    if (this.scriptPromise) return this.scriptPromise;
    this.scriptPromise = new Promise((resolve, reject) => {
      if (window.google?.payments?.api?.PaymentsClient) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://pay.google.com/gp/p/js/pay.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Google Pay API'));
      document.head.appendChild(script);
    });
    return this.scriptPromise;
  }

  private baseRequest(): { apiVersion: number; apiVersionMinor: number } {
    return { apiVersion: 2, apiVersionMinor: 0 };
  }

  private baseCardPaymentMethod(): GooglePayCardPaymentMethod {
    return {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: this.config.allowedAuthMethods as GooglePayAuthMethod[],
        allowedCardNetworks: this.config.allowedCardNetworks as GooglePayCardNetwork[],
      },
    };
  }

  private cardPaymentMethod(): unknown {
    return {
      ...this.baseCardPaymentMethod(),
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: {
          gateway: this.config.gateway,
          gatewayMerchantId: this.config.gatewayMerchantId,
        },
      },
    };
  }
}
