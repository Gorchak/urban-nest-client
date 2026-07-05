export const environment = {
  production: true,
  apiUrl: 'https://urban-nest-server.onrender.com/api',
  siteUrl: 'https://urban-nest-dev.netlify.app',
  googlePay: {
    environment: 'PRODUCTION' as const,
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
