module.exports = {
  "extends": [
    "recommended/esnext",
    "recommended/esnext/style-guide",
    "recommended/node",
    "recommended/node/style-guide",
  ],
  "rules": {
    // always require curly braces for if, else, etc.
    "curly": ["error", "all"],
    // indent with 2 spaces
    "indent": ["error", 2],
    // no spacing in string templates
    "template-curly-spacing": ["error", "never"],
    // allow require and module.exports
    "import/no-commonjs": 0,
    // use 'self' for capturing 'this' execution context
    "consistent-this": ["error", "self"],
    // console is only a warning
    "no-console": ["warn"],
  },
}
