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
    const { type, text, headline, additionalGlobalClass, buttonText, buttonAction } = props;
    const [NotificationIcon, setNotifcationIcon] = useState('');

    const iconComponents = {
        success: '/images/notificationicons/icon_success_white.svg',
        info: '/images/notificationicons/icon_info.svg',
        error: '/images/notificationicons/icon_error.svg',
    };

    useEffect(() => {
        setNotifcationIcon(iconComponents[type]);
    }, []);

    return (
        <>
            <div className={`${styles.basic} ${styles[type]} ${additionalGlobalClass ? additionalGlobalClass : ''}`} role="alert">
                <div className={styles.notificationflex}>
                    <div className={styles.icon} style={{ backgroundImage: `url(${NotificationIcon})` }}></div>
                    <div>
                        {headline && headline.length > 0 && (<strong>{headline}{' '}</strong>)}
                        {text && text.length > 0 && (<>{text}</>)}
                    </div>
                </div>
                {buttonText && (
                    <div className={`op__center-align op__margin_2_top`} >
                        <Button
                            text={buttonText}
                            type="primary"
                            onClickAction={buttonAction}
                        />
                    </div>
                )}
            </div>
        </>
    )
}
