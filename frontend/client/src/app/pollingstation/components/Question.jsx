'use client';
import React from "react";
import styles from "../styles/Question.module.css";
import { VoteOption } from "votingsystem";

export default function Question(props) {
    const { question, questionKey, showVoteOptions, setVote, selectedVote } = props;

    return (
        <>
            <div className="op__outerbox_grey">
                <h4>{question}</h4>

                {showVoteOptions && (
                    <div className={styles.vote_options} role="radiogroup">
                        <div className={styles.vote_option}>
                            <input
                                type="radio"
                                id ={`voteselect_${questionKey}_yes`}
                                name={`voteselect_${questionKey}`}
                                defaultChecked={selectedVote === VoteOption.Yes}
                                className={`${styles.checkmark} ${selectedVote === VoteOption.Yes ? styles.selected : ''}`}
                                value="Ich stimme zu"
                                onChange={() => setVote(VoteOption.Yes)}
                            />
                            <label htmlFor={`voteselect_${questionKey}_yes`}>Ich stimme zu</label>
                        </div>
                        <div className={styles.vote_option}>
                            <input
                                type="radio"
                                id ={`voteselect_${questionKey}_no`}
                                name={`voteselect_${questionKey}`}
                                defaultChecked={selectedVote === VoteOption.No}
                                className={`${styles.checkmark} ${selectedVote === VoteOption.No ? styles.selected : ''}`}
                                value="Ich stimme nicht zu"
                                onChange={() => setVote(VoteOption.No)}
                            />
                            <label htmlFor={`voteselect_${questionKey}_no`}>Ich stimme nicht zu</label>
                        </div>
                        <div className={styles.vote_option}>
                            <input
                                type="radio"
                                id = {`voteselect_${questionKey}_abstain`}
                                name={`voteselect_${questionKey}`}
                                defaultChecked={selectedVote === VoteOption.Abstain}
                                className={`${styles.checkmark} ${selectedVote === VoteOption.Abstain ? styles.selected : ''}`}
                                value="Ich enthalte mich"
                                onChange={() => setVote(VoteOption.Abstain)}
                            />
                            <label htmlFor={`voteselect_${questionKey}_abstain`}>Ich enthalte mich</label>
                        </div>
                    </div>
                )}

            </div>
        </>
    );
}
