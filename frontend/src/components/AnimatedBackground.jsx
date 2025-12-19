import { useEffect, useState, useMemo } from 'react';
import { Music, Music2, Music3, Music4 } from 'lucide-react';

const AnimatedBackground = () => {
  const [elements, setElements] = useState([]);

  const musicIcons = useMemo(() => [Music, Music2, Music3, Music4], []);

  useEffect(() => {
    const createElements = () => {
      const newElements = [];
      
      // Create bubbles
      for (let i = 0; i < 15; i++) {
        newElements.push({
          id: `bubble-${i}`,
          type: 'bubble',
          left: `${Math.random() * 100}%`,
          size: Math.random() * 60 + 20,
          duration: Math.random() * 15 + 15,
          delay: Math.random() * 10,
        });
      }
      
      // Create music notes
      for (let i = 0; i < 12; i++) {
        newElements.push({
          id: `note-${i}`,
          type: 'note',
          left: `${Math.random() * 100}%`,
          size: Math.random() * 30 + 20,
          duration: Math.random() * 20 + 20,
          delay: Math.random() * 15,
          iconIndex: Math.floor(Math.random() * 4),
        });
      }
      
      // Create piano keys
      for (let i = 0; i < 8; i++) {
        newElements.push({
          id: `piano-${i}`,
          type: 'piano',
          left: `${Math.random() * 100}%`,
          width: Math.random() * 15 + 10,
          height: Math.random() * 60 + 40,
          duration: Math.random() * 25 + 25,
          delay: Math.random() * 20,
        });
      }
      
      setElements(newElements);
    };
    
    createElements();
  }, []);

  return (
    <div className="animated-bg">
      {/* Gradient overlays */}
      <div className="absolute inset-0 divine-light opacity-50" />
      <div className="absolute inset-0 mystic-depth" />
      
      {elements.map((el) => {
        if (el.type === 'bubble') {
          return (
            <div
              key={el.id}
              className="bubble"
              style={{
                left: el.left,
                width: el.size,
                height: el.size,
                animationDuration: `${el.duration}s`,
                animationDelay: `${el.delay}s`,
              }}
            />
          );
        }
        
        if (el.type === 'note') {
          const IconComponent = musicIcons[el.iconIndex];
          return (
            <div
              key={el.id}
              className="music-note"
              style={{
                left: el.left,
                animationDuration: `${el.duration}s`,
                animationDelay: `${el.delay}s`,
              }}
            >
              <IconComponent size={el.size} />
            </div>
          );
        }
        
        if (el.type === 'piano') {
          return (
            <div
              key={el.id}
              className="piano-key"
              style={{
                left: el.left,
                width: el.width,
                height: el.height,
                animationDuration: `${el.duration}s`,
                animationDelay: `${el.delay}s`,
              }}
            />
          );
        }
        
        return null;
      })}
    </div>
  );
};

export default AnimatedBackground;
