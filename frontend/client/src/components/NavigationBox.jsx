'use client';

import styles from '../styles/NavigationBox.module.css';
import Button from './Button';

export default function NavigationBox(props) {
    const { head, text, buttonText, onClickAction, designImagePath } = props;

    return (
        <>
            <div onClick={onClickAction} className="op__outerbox_grey">
                <div className={styles.innerbox} style={{ backgroundImage: `url('/images/arrow-right-dark-grey.svg')` }}>
                    {designImagePath && (
                        <>
                        </>
                    )}
                    <h3>{head}</h3>
                    <p>{text}</p>
                    <Button
                        type="secondary-arrow"
                        text={buttonText}
                        style={{ backgroundImage: `url('/images/arrow-right-cyan.svg')` }}
                    />
                </div>
            </div>

        </>
    );
}
