import { useState, useEffect } from 'react';

export default function Timer({ initialTime, active, onTimeout }) {
    const [time, setTime] = useState(initialTime);

    useEffect(() => {
        setTime(initialTime);
    }, [initialTime]);

    useEffect(() => {
        let interval = null;
        if (active && time > 0) {
            interval = setInterval(() => {
                setTime((prev) => {
                    if (prev <= 1) {
                        onTimeout();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else if (!active) {
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [active, time, onTimeout]);

    const formatTime = (seconds) => {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min}:${sec < 10 ? '0' : ''}${sec}`;
    };

    return (
        <div className={`text-2xl font-mono font-bold px-4 py-2 rounded ${active ? 'bg-white text-slate-900 shadow-lg' : 'bg-slate-700 text-slate-400'}`}>
            {formatTime(time)}
        </div>
    );
}
