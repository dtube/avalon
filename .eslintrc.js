module.exports = {
    'env': {
        'commonjs': true,
        'es6': true,
        'node': true
    },
    'extends': 'eslint:recommended',
    'globals': {
        'Atomics': 'readonly',
        'SharedArrayBuffer': 'readonly',
        'db': 'writable',
        'logr': 'writable',
        'config': 'writable',
        'http': 'writable',
        'p2p': 'writable',
        'mongo': 'writable',
        'chain': 'writable',
        'transaction': 'writable',
        'cache': 'writable',
        'notifications': 'writable',
        'closing': 'writable',
        'newRankings': 'writable'
    },
    'parserOptions': {
        'ecmaVersion': 2018
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
        'no-magic-numbers': [
            'warn',
            {
                'ignore': [-1, 0, 1, 2]
            }
        ],
        'no-useless-concat': 'error'
        // 'complexity': [
        //     'warn',
        //     20
        // ]
    }
}