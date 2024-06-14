'use client';
import React, { useState, useEffect } from "react";
import Image from "next/image";
import styles from "../styles/ElectionHeader.module.css"

export default function Electionheader(props) {
  const { election, electionInformations } = props;
  const [timeLeft, setTimeLeft] = useState({});

  const electionCountdown = () => { 
    const currentTime = Math.floor (new Date().getTime()/ 1000);
    const distance =   election.endTime - currentTime;

    const lefties = {
      leftdays: Math.floor(distance / ( 60 * 60 * 24)),
      lefthours: Math.floor((distance % (60 * 60 * 24)) / (60 * 60)),
      leftminutes: Math.floor((distance % (60 * 60)) / (60))     };

     setTimeLeft({
      ...timeLeft, 
      days: lefties.leftdays.toString(),
      hours: lefties.lefthours.toString(),
      minutes: lefties.leftminutes.toString(),
    });
  }

  useEffect(() => {
    //countdown refreshes every minute as it should not rerender every second cause this could cause timing problems
    electionCountdown();
      setInterval(() => {
        electionCountdown();
    }, 60000);
  }, []);

  return (
    <>
      <div className={styles.greystripe}>
        
        <div className="op__contentbox_760">
          <Image
            src="https://static.openpetition.de/images/people-protesting-eu-medium.jpg?1716990305" 
            className={styles.election_image}
            width={0}
            height={0}
            sizes="100vw"
          />
          <div className={styles.election_informations}>
            <h4>{electionInformations.summary}</h4>


            Status: {election.status}<br />
            Stimmen: {election.totalVotes}

          </div>
        </div>
      </div>
        <div className={styles.bluestripe}>
          <div className="op__contentbox_760">
            {timeLeft && Object.keys(timeLeft).length > 0 && (
              <div className={styles.timer_mainbox}>
                <div className={styles.timer_headline}>Abstimmung läuft noch:</div>
                <div className={styles.timer}>
                  <div className={styles.timer_item}><h4>{timeLeft.days}</h4>Tage</div>
                  <div className={styles.timer_item_between}><h4>:</h4></div>
                  <div className={styles.timer_item}><h4>{timeLeft.hours}</h4>Stunden</div>
                  <div className={styles.timer_item_between}><h4>:</h4></div>
                  <div className={styles.timer_item}><h4>{timeLeft.minutes}</h4>Minuten</div>
                </div>
              </div>
          )}
          </div>
        </div>


    </>
  )
}