import React from 'react';

export default function SeatMap({ capacity, seats, onSelect, selected }){
  const taken = new Set(seats.map(s=>s.seat_number));
  const cols = 4; // simple grid
  const rows = Math.ceil(capacity/cols);
  const arr=[];
  for(let r=0;r<rows;r++){
    const row=[];
    for(let c=0;c<cols;c++){
      const num = r*cols + c + 1;
      if(num>capacity) break;
      const isTaken = taken.has(num);
      row.push(
        <button key={num} disabled={isTaken} onClick={()=>onSelect(num)} style={{margin:6,padding:10,opacity:isTaken?0.5:1,background:selected===num?'#4caf50':'#eee'}}>
          {num}
        </button>
      )
    }
    arr.push(<div key={r} style={{display:'flex'}}>{row}</div>);
  }
  return <div>{arr}</div>;
}