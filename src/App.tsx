import { useEffect, useState } from 'react'
import { PlayerProvider, PlayerBar } from './ui/player'
import { Library, Story, Lens, Theory, About } from './ui/pages'

const NAV = [['library', 'Library'], ['theory', 'Theory'], ['story', 'Story'], ['lens', "Drummers"]] as const

export default function App() {
  const read = () => location.hash.replace(/^#\/?/, '') || 'library'
  const [route, setRoute] = useState(read)
  useEffect(() => { const f = () => { setRoute(read()); window.scrollTo(0, 0) }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f) }, [])
  const go = (h: string) => { location.hash = `/${h}` }
  const [page, sub] = route.split('/')
  return (
    <PlayerProvider>
      <div className="max-w-xl mx-auto px-6 pb-16">
        <nav className="pt-5 pb-2">
          <a href="#/library" className="flex items-center gap-2 text-[20px] font-semibold tracking-tight"><span className="w-[10px] h-[10px] rounded-full bg-amber" />Pulse</a>
          <div className="mt-3 flex flex-nowrap justify-center gap-x-5 whitespace-nowrap">{NAV.map(([k, l]) => <a key={k} href={`#/${k}`} aria-current={page === k ? 'page' : undefined} className={`py-1 text-[15px] ${page === k ? 'text-amber' : 'text-bone/80'}`}>{l}</a>)}</div>
        </nav>
        <PlayerBar />
        <main key={route} className={`${['about', 'theory', 'story', 'lens'].includes(page) ? 'pt-8' : 'pt-4'} rise`}>
          {page === 'about' ? <About /> : page === 'theory' ? <Theory /> : page === 'story' ? <Story /> : page === 'lens' ? <Lens id={sub} go={go} /> : <Library />}
        </main>
        <footer className="mt-24 mb-24 pt-8 flex justify-between text-[13px] text-mute"><span>Pulse</span><a href="#/about">About & credits</a></footer>
      </div>
    </PlayerProvider>
  )
}
