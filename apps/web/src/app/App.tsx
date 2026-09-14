import { useState } from 'react';

type Screen = 'home' | 'room' | 'settings';

const members = ['{name}', 'Влад', 'Юра'];

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [roomName, setRoomName] = useState('');
  const [roomCreated, setRoomCreated] = useState(false);

  if (screen === 'settings') {
    return <Settings onBack={() => setScreen('home')} />;
  }

  if (screen === 'room') {
    return <Room roomName={roomName || 'Movie Night'} onBack={() => setScreen('home')} />;
  }

  return (
    <main className="phone-frame">
      <header className="topbar">
        <span>Здравствуйте, {'{name}'}</span>
        <button className="avatar" onClick={() => setScreen('settings')} aria-label="Настройки">●</button>
      </header>
      <section className="content home">
        <h1>Режим выбор<br />фильма</h1>
        <button className="primary" onClick={() => setRoomCreated(true)}>Создать комнату</button>
        <button className="primary" onClick={() => setScreen('room')}>Войти в комнату</button>
        <div className="hero-placeholder">Movie Match</div>
      </section>
      {roomCreated && (
        <div className="overlay">
          <div className="modal">
            <h2>Создать комнату</h2>
            <input autoFocus value={roomName} onChange={e => setRoomName(e.target.value)} placeholder="Название комнаты" />
            <button className="primary" onClick={() => { setRoomCreated(false); setScreen('room'); }}>Создать</button>
          </div>
        </div>
      )}
    </main>
  );
}

function Room({ roomName, onBack }: { roomName: string; onBack: () => void }) {
  return <main className="phone-frame">
    <header className="topbar"><button className="link" onClick={onBack}>←</button><span>Здравствуйте, {'{name}'}</span><span className="avatar">●</span></header>
    <section className="content">
      <h1>Комната<br /><strong>{roomName}</strong></h1>
      <div className="members">{members.map(member => <div className="member" key={member}><span className="member-avatar">●</span>{member}</div>)}</div>
      <div className="room-actions"><button>Вход по QR-коду</button><button>Пригласить друга</button></div>
    </section>
  </main>;
}

function Settings({ onBack }: { onBack: () => void }) {
  return <main className="phone-frame">
    <header className="topbar"><button className="link" onClick={onBack}>←</button><span>Здравствуйте, {'{name}'}</span><span className="avatar">●</span></header>
    <section className="content settings">
      <h1>Настройки</h1><div className="profile-avatar">●</div><h2>{'{name}'}</h2><p>Имя пользователя: {'{userName}'}</p>
      <button className="primary">Сменить пароль</button><button className="danger">Выйти из аккаунта</button><button className="secondary">Цензура</button>
    </section>
  </main>;
}
