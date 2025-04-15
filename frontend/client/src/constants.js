import {t} from "i18next";

const globalConst = {
    pages: {
        'CREATEKEY': 'createkey',
        'REGISTER': 'register',
        'POLLINGSTATION': 'pollingstation',
        'VOTETRANSACTION': 'votetransaction',
        'LOADING': 'loading',
        'ERROR': 'error',
        'FAQ': 'faq'
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
    faqContent: {
        'anonymouselectionpermit': {
            'title': t("faq.content.anonymouselectionpermit.title"),
            'text': t("faq.content.anonymouselectionpermit.text")
        },
        'ballotpaper': {
            'title': t("faq.content.ballotpaper.title"),
            'text': t("faq.content.ballotpaper.text")
        },
        'election': {
            'title': t("faq.content.election.title"),
            'text': t("faq.content.election.text")
        },
        'electoralauthority': {
            'title': t("faq.content.electoralauthority.title"),
            'text': t("faq.content.electoralauthority.text")
        },
        'electionnotification': {
            'title': t("faq.content.electionnotification.title"),
            'text': t("faq.content.electionnotification.text")
        },
        'electionpapers': {
            'title': t("faq.content.electionpapers.title"),
            'text': t("faq.content.electionpapers.text")
        },
        'electionresultverification': {
            'title': t("faq.content.electionresultverification.title"),
            'text': t("faq.content.electionresultverification.text")
        },
        'encryptedvote': {
            'title': t("faq.content.encryptedvote.title"),
            'text': t("faq.content.encryptedvote.text")
        },
        'personalelectionpermit': {
            'title': t("faq.content.personalelectionpermit.title"),
            'text': t("faq.content.personalelectionpermit.text")
        },
        'voter': {
            'title': t("faq.content.voter.title"),
            'text': t("faq.content.voter.text")
        },
        'votingkey': {
            'title': t("faq.content.votingkey.title"),
            'text': t("faq.content.votingkey.text")
        },
    }

};

export default globalConst;
