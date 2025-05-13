'use client';
import styles from "../styles/Question.module.css";
import { VoteOption } from "votingsystem";
import { useTranslation } from 'next-i18next';

export default function Question(props) {
    const { question, questionKey, showVoteOptions, setVote, selectedVote, imageUrl } = props;
    const { t } = useTranslation();

    return (
        <>
            <div className={`${styles.question_container} op__outerbox_grey`}>
                <div className={`${styles.question_container_image}`}>
                    <img
                        src={imageUrl}
                        alt=""
                    />
                </div>

                <div className={`${styles.question_container_text}`}>
                    <h4>{question}</h4>
                    {showVoteOptions && (
                        <div className={styles.vote_options} role="radiogroup">
                            <div className={styles.vote_option}>
                                <label htmlFor={`voteselect_${questionKey}_yes`}>{t("pollingstation.question.answer.yes")}</label>
                                <input
                                    type="radio"
                                    id={`voteselect_${questionKey}_yes`}
                                    name={`voteselect_${questionKey}`}
                                    defaultChecked={selectedVote === VoteOption.Yes}
                                    className={`${styles.checkmark} ${selectedVote === VoteOption.Yes ? styles.selected : ''}`}
                                    value={t("pollingstation.question.answer.yes")}
                                    onChange={() => setVote(VoteOption.Yes)}
                                />
                            </div>
                            <div className={styles.vote_option}>
                                <label htmlFor={`voteselect_${questionKey}_no`}>{t("pollingstation.question.answer.no")}</label>
                                <input
                                    type="radio"
                                    id={`voteselect_${questionKey}_no`}
                                    name={`voteselect_${questionKey}`}
                                    defaultChecked={selectedVote === VoteOption.No}
                                    className={`${styles.checkmark} ${selectedVote === VoteOption.No ? styles.selected : ''}`}
                                    value={t("pollingstation.question.answer.no")}
                                    onChange={() => setVote(VoteOption.No)}
                                />
                            </div>
                            <div className={styles.vote_option}>
                                <label htmlFor={`voteselect_${questionKey}_abstain`}>{t("pollingstation.question.answer.abstain")}</label>
                                <input
                                    type="radio"
                                    id={`voteselect_${questionKey}_abstain`}
                                    name={`voteselect_${questionKey}`}
                                    defaultChecked={selectedVote === VoteOption.Abstain}
                                    className={`${styles.checkmark} ${selectedVote === VoteOption.Abstain ? styles.selected : ''}`}
                                    value={t("pollingstation.question.answer.abstain")}
                                    onChange={() => setVote(VoteOption.Abstain)}
                                />
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </>
    );
}
