'use client';
import React, { useState, useEffect } from 'react';
import styles from '../styles/Notification.module.css';


/**  
 * types can be error, info, success
 * @param {*} props 
 * @returns 
 */
export default function Notification(props) {
  const { type, text, headline } = props;
  const [ NotificationIcon, setNotifcationIcon ] = useState('');
  
  const iconComponents = {
    success: '/images/notificationicons/icon_success.svg',
    info: '/images/notificationicons/icon_info.svg',
    error: '/images/notificationicons/icon_error.svg',
  };

  useEffect(() => {
      setNotifcationIcon(iconComponents[type]);
  }, []);

  return (
    <>
        <div className={`${styles.basic}  ${styles[type]}`} role="alert">
          <div className={styles.icon} style={{ backgroundImage: `url(${NotificationIcon})` }}></div>
          <div>
            {headline && headline.length > 0 && (<strong>{headline}{' '}</strong>)}
            {text}
          </div>
        </div>
    </>
  )
}