// Offline UI tests use an installed system font; production fonts are unchanged.
module.exports = new Proxy(
  {},
  {
    get: () =>
      "@font-face { font-family: 'Fixture'; src: local('Arial'); font-weight: 100 900; font-style: normal; }",
  },
);
