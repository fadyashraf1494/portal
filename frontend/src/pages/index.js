import useSWR from 'swr'
import API from '../lib/api'
import Link from 'next/link'

const fetcher = url => API.get(url).then(r=>r.data)

export default function Home(){
  const {data, error} = useSWR('/api/buses', fetcher)
  if (error) return <div>failed to load</div>
  if (!data) return <div>loading...</div>
  return (
    <div style={{padding:20}}>
      <h1>Company Buses</h1>
      <ul>
        {data.map(bus => (
          <li key={bus.id} style={{margin:10}}>
            <strong>{bus.name}</strong> — {bus.route} — Driver: {bus.driver_name} — Capacity: {bus.capacity}
            {' '}<Link href={`/bus/${bus.id}`}><a>Manage/Book</a></Link>
          </li>
        ))}
      </ul>
    </div>
  )
}