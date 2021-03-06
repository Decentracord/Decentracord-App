module.exports = {
	'env': {
		'browser': true,
		'es6': true,
		'node': true
	},
	'extends': 'eslint:recommended',
	parserOptions: {
		ecmaVersion: 2020
	},
	'rules': {
		'indent': [
			'error',
			'tab'
		],
		'linebreak-style': [
			'error',
			'unix'
		],
		'quotes': [
			'error',
			'single'
		],
		'semi': [
			'error',
			'always'
		],
		'no-console': process.env.NODE_ENV === 'production' ? 2 : 0,
		'no-debugger': process.env.NODE_ENV === 'production' ? 2 : 0,
		'no-unused-vars': 'warn',
		'no-empty': 'warn'
	},
	'globals': {
		'io': false,
		'socket': false,
		'google': false,
		'nameIntoCode': false,
		'artifacts': false
	}
};