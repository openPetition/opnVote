import { t } from "i18next";

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

export const translationConst = {
    pollingStationElectionHeaderCountdown: {
        [globalConst.electionState.PLANNED]: t('pollingstation.electionheader.countdown.headline.planned'),
        [globalConst.electionState.ONGOING]: t('pollingstation.electionheader.countdown.headline.ongoing'),
        [globalConst.electionState.FINISHED]: t('pollingstation.electionheader.countdown.headline.finished'),
    },
    pollingStationElectionHeaderStateTitle: {
        [globalConst.electionState.PLANNED]: t('pollingstation.electionHeader.statetitle.planned'),
        [globalConst.electionState.ONGOING]: t('pollingstation.electionHeader.statetitle.ongoing'),
        [globalConst.electionState.FINISHED]: t('pollingstation.electionHeader.statetitle.finished'),
    },
    registerSmallHeaderStateTitle: {
        [globalConst.electionState.PLANNED]: t('register.smallHeader.statetitle.planned'),
        [globalConst.electionState.ONGOING]: t('register.smallHeader.statetitle.ongoing'),
        [globalConst.electionState.FINISHED]: t('register.smallHeader.statetitle.finished'),
    },
    registerSmallHeaderWhatshappening: {
        [globalConst.electionState.PLANNED]: t('register.smallHeader.whatshappening.state.planned'),
        [globalConst.electionState.ONGOING]: t('register.smallHeader.whatshappening.state.ongoing'),
        [globalConst.electionState.FINISHED]: t('register.smallHeader.whatshappening.state.finished'),
    },
};

export default globalConst;
