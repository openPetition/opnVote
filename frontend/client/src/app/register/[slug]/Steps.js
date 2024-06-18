'use client';

import React, { useState, useEffect } from "react";
import {useStepStore} from "./zustand";

export default function Steps() {
    const activestep = useStepStore((state) => state.step)

    return (
        <>
            <div className="bg-op-blue-main">
                1
                <span className="">2</span>
                3
                4
            </div>

        </>
    );
}
