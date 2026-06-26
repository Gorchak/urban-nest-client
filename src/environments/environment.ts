export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  siteUrl: 'http://localhost:4200',
  googlePay: {
    environment: 'TEST' as const,
    merchantId: 'BCR2DN7TTCTIZVA6',
    merchantName: 'Ulia',
    countryCode: 'UA',
    currencyCode: 'UAH',
    allowedCardNetworks: ['VISA', 'MASTERCARD'],
    allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
    gateway: 'wayforpay',
    gatewayMerchantId: 'BCR2DN7TTCTIZVA6',
  },
};
