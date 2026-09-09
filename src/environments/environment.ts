export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  siteUrl: 'http://localhost:4200',
  googleClientId: '802148002511-kvahn897tkep45jsmp68ljs47r6962e9.apps.googleusercontent.com',
  googlePay: {
    environment: 'PRODUCTION' as const,
    merchantId: 'BCR2DN7TTCTIZVA6',
    merchantName: 'Ulia',
    countryCode: 'UA',
    currencyCode: 'UAH',
    allowedCardNetworks: ['VISA', 'MASTERCARD'],
    allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
    gateway: 'wayforpay',
    gatewayMerchantId: 'urban_nest_dev_netlify_app',
  },
};
