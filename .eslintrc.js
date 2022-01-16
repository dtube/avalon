module.exports = {
    'env': {
        'commonjs': true,
        'es6': true,
        'es2020': true,
        'node': true
    },
    'extends': 'eslint:recommended',
    'globals': {
        'Atomics': 'readonly',
        'SharedArrayBuffer': 'readonly',
        'db': 'writable',
        'logr': 'writable',
        'config': 'writable',
        'p2p': 'writable',
        'eco': 'writable',
        'validate': 'writable',
        'chain': 'writable',
        'transaction': 'writable',
        'cache': 'writable',
        'notifications': 'writable',
        'closing': 'writable',
        'rankings': 'writable',
        'newRankings': 'writable',
        'consensus': 'writable',
        'leaderStats': 'writable'
    },
    'parserOptions': {
        'ecmaVersion': 2020
    },
    'rules': {
        'indent': [
            'error',
            4
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
            'never'
        ],
        'curly': [
            'error',
            'multi'
        ],
        'eqeqeq': [
            'error',
            'smart'
        ],
        'no-case-declarations': [
            'off'
        ],
        'no-magic-numbers': [
            'warn',
            {
                'ignore': [-1, 0, 1, 2, 10, 400, 404, 500, 1000]
            }
        ],
        'no-useless-concat': 'error',
        'no-empty': [
            'error', {
                'allowEmptyCatch': true
            }
        ]
        // 'complexity': [
        //     'warn',
        //     20
        // ]
    }
}