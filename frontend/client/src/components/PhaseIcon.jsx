const variants = {
    blue: {
        circleStroke: '#29b0cc',
        circleFill: '#29b0cc',
        color: '#ffffff',
        viewBox: '0 0 50 50',
    },
    blueInversed: {
        circleStroke: '#a9dfeb',
        circleFill: '#ffffff',
        color: '#a9dfeb',
        viewBox: '0 0 50 50',
    },
    black: {
        circleStroke: '#3e3d40',
        circleFill: '#3e3d40',
        color: '#ffffff',
        viewBox: '0 0 50 50',
    },
    bare: {
        circleStroke: null,
        circleFill: null,
        color: '#3e3d40',
        viewBox: '14 14 22 22', // native size of bare is 22x22
    },
};

export default function PhaseIcon({type, variant="blue", width=50, height=50, className="", style={}}) {
    const {circleStroke, circleFill, color, viewBox} = variants[variant];

    return (
        <svg style={style} className={className} width={width} height={height} viewBox={viewBox} version="1.1" xmlns="http://www.w3.org/2000/svg">
            {circleStroke && (<circle stroke="none" fill={circleStroke} cy="25" cx="25" r="25" />)}
            {circleFill && (<circle stroke="none" fill={circleFill} cy="25" cx="25" r="23" />)}
            {type == "id" && (
                <g>
                    <path d="m 29,23 h 2" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    <path d="m 29,27 h 2" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    <path d="m 19.17,28 a 3,3 0 0 1 5.66,0" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    <circle cx="22" cy="24" r="2" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                    <rect width="20" height="14" rx="2" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" x="15" y="18" />
                </g>
            )}
            {type == "ballot" && (
                <g id="receipt-text" transform="translate(13 13)">
                    <path d="M4,2V22l2-1,2,1,2-1,2,1,2-1,2,1,2-1,2,1V2L18,3,16,2,14,3,12,2,10,3,8,2,6,3Z" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                    <path d="M14,8H8" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                    <path d="M16,12H8" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                    <path d="M13,16H8" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                </g>
            )}
            {type == "key" && (
                <g transform="translate(13 13)">
                    <path d="M2.586,17.414A2,2,0,0,0,2,18.828V21a1,1,0,0,0,1,1H6a1,1,0,0,0,1-1V20a1,1,0,0,1,1-1H9a1,1,0,0,0,1-1V17a1,1,0,0,1,1-1h.172a2,2,0,0,0,1.414-.586L13.4,14.6a6.5,6.5,0,1,0-4-4Z" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" fill="none"/>
                    <circle cx="16.5" cy="7.5" r="1.5" fill={color} />
                </g>
            )}
            {type == "vote" && (
                <g>
                    <circle cx="25" cy="25" r="9" fill="none" stroke={color} strokeWidth="2"/>
                    <path d="M35,15,15,35" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                    <path d="M15,15,35,35" fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/>
                </g>
            )}
        </svg>
    );
};
