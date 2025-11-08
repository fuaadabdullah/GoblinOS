module.exports = {
	root: true,
	env: { browser: true, es2022: true },
	extends: [
		"eslint:recommended",
		"plugin:@typescript-eslint/recommended",
		"plugin:react-hooks/recommended",
		"plugin:jsx-a11y/recommended",
		"plugin:compat/recommended",
		"plugin:import/recommended",
		"plugin:import/typescript",
		"plugin:promise/recommended",
		"prettier",
	],
	parser: "@typescript-eslint/parser",
	parserOptions: {
		ecmaVersion: "latest",
		sourceType: "module",
		ecmaFeatures: {
			jsx: true,
		},
	},
	plugins: [
		"react-refresh",
		"@typescript-eslint",
		"jsx-a11y",
		"compat",
		"import",
		"promise",
	],
	settings: {
		"import/resolver": {
			typescript: true,
			node: true,
		},
		compat: {
			browserslist: ["> 0.5%", "last 2 versions", "not dead"],
		},
	},
	rules: {
		"no-console": "off",
		"react-refresh/only-export-components": [
			"warn",
			{ allowConstantExport: true },
		],
		// Additional rules for better code quality
		"import/no-unresolved": "error",
		"import/named": "error",
		"import/default": "error",
		"import/namespace": "error",
		"promise/always-return": "off", // Can be too strict for React components
		"promise/no-return-wrap": "error",
		"promise/param-names": "error",
		"promise/catch-or-return": "error",
		"promise/no-native": "off", // Allow native promises
		"promise/no-nesting": "warn",
		"promise/no-promise-in-callback": "warn",
		"promise/no-callback-in-promise": "warn",
		"promise/avoid-new": "off", // Allow new Promise() when needed
		"promise/no-return-in-finally": "warn",
	},
};
