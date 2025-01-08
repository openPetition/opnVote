'use client';

import styles from '../styles/NavigationBox.module.css';

export default function NavigationBox(props) {
    const { head, text, onClickAction } = props;

    return (
        <>
            <div
                onClick={onClickAction}
                className="op__outerbox_grey"
            >
                <div className={styles.innerbox}>
                    <h3>{head}</h3>
                    <p>{text}</p>
                </div>
            </div>
        </>
    );
}
