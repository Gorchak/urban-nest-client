export const environment = {
  production: true,
  apiUrl: 'https://api.uliastore.com.ua/api',
  siteUrl: 'http://uliastore.com.ua',
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
