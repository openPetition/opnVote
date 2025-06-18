'use client';

import styles from '../styles/Button.module.css';

export default function Button(props) {
    const { text, type, onClickAction, style, isDisabled, stretched } = props;

    return (
        <>
            <button
                onClick={onClickAction}
                disabled={isDisabled}
                className={`${styles.btn} ${styles[type]} ${stretched ? 'op__width_100' : ''}`}
                style={style}
            >
                {text}
            </button>
        </>
    );
}
