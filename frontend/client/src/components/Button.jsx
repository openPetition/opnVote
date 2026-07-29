'use client';

import React, { forwardRef } from 'react';
import styles from '../styles/Button.module.css';

const Button = forwardRef(function Button(
    { type, stretched, children, ...props },
    ref
) {
    return (
        <button
            ref={ref}
            {...props}
            className={`${styles.btn} ${styles[type]} ${stretched ? 'op__width_100' : ''} ${props.className}`}
        >
            {children}
        </button>
    );
});

export default Button;
