export const environment = {
  production: true,
  apiUrl: 'https://api.uliastore.com.ua/api',
  siteUrl: 'https://uliastore.com.ua',
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
