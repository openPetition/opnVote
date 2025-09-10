const globalConst = {
    progressBarStep: {
        'id': 1,
        'key': 2,
        'ballot': 3,
        'vote': 4,
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
