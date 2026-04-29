const globalConst = {
    progressBarStep: {
        'id': 1,
        'createKey': 2,
        'saveKey': 3,
        'savedKey': 4,
        'createBallot': 5,
        'saveBallot': 6,
        'readyToVote': 7,
        'vote': 8,
    },
    progressMapping: {
        2: 0, //createKey,
        3: 25, //saveKey
        4: 50, //savedKey
        5: 50, //createBallot
        6: 75, //saveBallot
        7: 100, //savedBallot - readyToVote
    },
    pages: {
        'OVERVIEW': 'overview',
        'CREATEKEY': 'createkey',
        'LOADKEY': 'loadkey',
        'SHOWKEY': 'showkey',
        'REGISTER': 'register',
        'LOADBALLOT': 'loadballot',
        'POLLINGSTATION': 'pollingstation',
        'VOTETRANSACTION': 'votetransaction',
        'LOADING': 'loading',
        'ERROR': 'error',
        'FAQ': 'faq',
        'GLOSSARY': 'glossary',
    },
    electionState: {
        'PLANNED': 'planned',
        'ONGOING': 'ongoing',
        'FINISHED': 'finished'
    },
    languages: {
        de: {
            short: 'de',
            translationkey: 'language.german',
            flagpath: '/images/icons/de.svg'
        },
        en: {
            short: 'en',
            translationkey: 'language.english',
            flagpath: '/images/icons/gb.svg'
        }
    },
    ERROR: {
        'JWTAUTH': 'jwtauth',
        'ALREADYREGISTERED': 'alreadyregistered',
        'GENERAL': 'general'
    },
    pdfType: {
        'VOTINGKEY': 'votingkey',
        'ELECTIONPERMIT': 'electionpermit',
    },
};

export default globalConst;
