import {useRouter} from 'next/router'
import useSWR from 'swr'
import API from '../../lib/api'
import SeatMap from '../../components/SeatMap'
import { useState } from 'react'

const fetcher = url => API.get(url).then(r=>r.data)

export default function Bus(){
  const router = useRouter();
  const { id } = router.query;
  const { data, mutate } = useSWR(id?`/api/buses/${id}/seats`:null, fetcher)
  const [selected, setSelected] = useState(null)
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null

  async function book(){
    if(!selected) return alert('select seat');
    try{
      await API.post('/api/bookings', { bus_id: parseInt(id), seat_number: selected }, { headers: { Authorization: `Bearer ${token}` } })
      alert('booked')
      mutate()
    }catch(e){ alert(e.response?.data?.error || 'failed') }
  }

  if(!data) return <div>loading...</div>
  return (
    <div style={{padding:20}}>
      <h2>Bus {id}</h2>
      <SeatMap capacity={data.capacity} seats={data.seats} onSelect={setSelected} selected={selected} />
      <div style={{marginTop:20}}>
        <button onClick={book}>Book seat {selected || ''}</button>
      </div>
    </div>
  )
}