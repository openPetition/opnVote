'use client';
import styles from "../styles/Question.module.css";
import { VoteOption } from "votingsystem";
import { useTranslation } from 'next-i18next';

export default function Question(props) {
    const { question, questionKey, showVoteOptions, setVote, selectedVote, imageUrl } = props;
    const { t } = useTranslation();

    const handleToggle = (option, isChecked) => {
        if (isChecked) {
            setVote(option);
        } else {
            setVote(VoteOption.Invalid);
        }
    };

    return (
        <>
            <div className={`${styles.question_container} `}>
                <div className={`${styles.question_container_image}`}>
                    <img
                        src={imageUrl}
                        alt=""
                    />
                </div>

                <div className={`${styles.question_container_text}`}>
                    <h3 className={styles.h3}>{question}</h3>
                    {showVoteOptions && (
                        <div className={styles.wrapper}>
                            <div className={styles.vote_options} role="radiogroup">
                                <div className={styles.vote_option}>
                                    <label
                                        htmlFor={`voteselect_${questionKey}_yes`}>{t("pollingstation.question.answer.yes")}</label>
                                    <input
                                        type="checkbox"
                                        id={`voteselect_${questionKey}_yes`}
                                        name={`voteselect_${questionKey}`}
                                        defaultChecked={selectedVote === VoteOption.Yes}
                                        className={`${styles.voting_field} ${selectedVote === VoteOption.Yes ? styles.selected : ''}`}
                                        value={t("pollingstation.question.answer.yes")}
                                        onChange={(e) => handleToggle(VoteOption.Yes, e.target.checked)}
                                    />
                                </div>
                                <div className={styles.vote_option}>
                                    <label
                                        htmlFor={`voteselect_${questionKey}_no`}>{t("pollingstation.question.answer.no")}</label>
                                    <input
                                        type="checkbox"
                                        id={`voteselect_${questionKey}_no`}
                                        name={`voteselect_${questionKey}`}
                                        defaultChecked={selectedVote === VoteOption.No}
                                        className={`${styles.voting_field} ${selectedVote === VoteOption.No ? styles.selected : ''}`}
                                        value={t("pollingstation.question.answer.no")}
                                        onChange={(e) => handleToggle(VoteOption.No, e.target.checked)}
                                    />
                                </div>
                                <div className={styles.vote_option}>
                                    <label
                                        htmlFor={`voteselect_${questionKey}_abstain`}>{t("pollingstation.question.answer.abstain")}</label>
                                    <input
                                        type="checkbox"
                                        id={`voteselect_${questionKey}_abstain`}
                                        name={`voteselect_${questionKey}`}
                                        defaultChecked={selectedVote === VoteOption.Abstain}
                                        className={`${styles.voting_field} ${selectedVote === VoteOption.Abstain ? styles.selected : ''}`}
                                        value={t("pollingstation.question.answer.abstain")}
                                        onChange={(e) => handleToggle(VoteOption.Abstain, e.target.checked)}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>

            </div>
            <hr />
        </>
    );
}
