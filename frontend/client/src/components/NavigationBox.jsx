'use client';

import styles from '../styles/NavigationBox.module.css';
import Button from './Button';

export default function NavigationBox(props) {
    const { head, text, buttonText, onClick, designImagePath } = props;

    return (
        <>
            <div onClick={onClick} className="op__outerbox_grey op__margin_standard_20_top_bottom">
                <div className={styles.innerbox} style={{ backgroundImage: `url('/images/arrow-right-dark-grey.svg')` }}>
                    {designImagePath && (
                        <>
                        </>
                    )}
                    <h3>{head}</h3>
                    <p>{text}</p>
                    <Button
                        type="secondary-arrow"
                        style={{ backgroundImage: `url('/images/arrow-right-cyan.svg')` }}
                    >{buttonText}</Button>
                </div>
            </div>

        </>
    );
}
