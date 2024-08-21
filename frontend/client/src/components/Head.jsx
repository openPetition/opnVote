'use client';
import React, { useState, useEffect } from "react";
import Image from 'next/image';
import styles from '../styles/Header.module.css';

export default function Head() {
    return (
      <>
        <div className={styles.header}>
          <Image
            alt="open.vote logo"
            src="/images/opnvote-logo.png" 
            height={68}
            width={194}
            style={{margin: "1rem auto"}} 
          />
        </div>
      </>
    )
}