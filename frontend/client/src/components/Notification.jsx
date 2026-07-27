'use client';
import { useState, useEffect } from 'react';
import styles from '../styles/Notification.module.css';
import Button from './Button';

/**
 * types can be error, info, success
 * @param {*} props
 * @returns
 */
export default function Notification(props) {
    const { type, text, headline, additionalGlobalClass, buttonText, buttonAction, htmlText, linkText, linkAction } = props;
    const [NotificationIcon, setNotifcationIcon] = useState('');

    const iconComponents = {
        success: '/images/notificationicons/icon_success_white.svg',
        info: '/images/notificationicons/icon_info.svg',
        error: '/images/notificationicons/icon_error.svg',
        attention: '/images/notificationicons/icon_attention.svg'
    };

    useEffect(() => {
        setNotifcationIcon(iconComponents[type]);
    }, []);

    return (
        <>
            <div className={`op__margin_standard_top ${styles.basic} ${styles[type]} ${additionalGlobalClass ? additionalGlobalClass : ''}`} role="alert">
                <div className={styles.notificationflex}>
                    <div className={styles.icon} style={{ backgroundImage: `url(${NotificationIcon})` }}></div>
                    <div>
                        {headline && headline.length > 0 && (<strong>{headline}{' '}</strong>)}
                        {text && <div>{text}</div>}
                        {htmlText && typeof htmlText === 'string' && htmlText.length > 0 && (
                            <div dangerouslySetInnerHTML={{ __html: htmlText }} />
                        )}
                        {linkText && (
                            <button
                                className={styles.linkButton}
                                type="button"
                                onClick={linkAction}
                            >
                                {linkText}
                            </button>
                        )}
                    </div>
                </div>
                {buttonText && (
                    <div className={`op__center-align op__margin_standard_top`} >
                        <Button
                            type="primary"
                            onClick={buttonAction}
                        >{buttonText}</Button>
                    </div>
                )}
            </div>
        </>
    )
}
