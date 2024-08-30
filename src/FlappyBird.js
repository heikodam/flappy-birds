import React, { useRef, useEffect, useCallback, useState } from 'react';
import './FlappyBird.css';
import ImageLoader from './ImageLoader';

const useGameLoop = (callback) => {
  const requestRef = useRef();
  const previousTimeRef = useRef();

  const animate = time => {
    if (previousTimeRef.current != undefined) {
      const deltaTime = time - previousTimeRef.current;
      callback(deltaTime);
    }
    previousTimeRef.current = time;
    requestRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current);
  }, []);
};

const PIPE_WIDTH = 50;
const PIPE_GAP_HARD = 150; // Smallest gap for hard difficulty
const PIPE_GAP_MEDIUM = 200; // Medium gap
const PIPE_GAP_EASY = 250; // Largest gap for easy difficulty
const PIPE_SPEED = 2; // Constant speed for all difficulties
const PIPE_INTERVAL = 100; // Constant interval between pipes for all difficulties

const BIRD_WIDTH = 48;  // 70% of 68 (rounded up)
const BIRD_HEIGHT = 34; // 70% of 48 (rounded up)
const BIRD_FRAMES = 3;
const FRAME_DELAY = 5;

const GRAVITY = 0.5;
const MAX_VELOCITY = 10;
const JUMP_STRENGTH = -10;

const BIRD_ROTATION_FACTOR = 0.3;

const FlappyBird = () => {

  const canvasRef = useRef(null);
  const birdRef = useRef({ x: 50, y: 200, velocity: 0, frame: 0 });
  const pipesRef = useRef([]);
  const frameCountRef = useRef(0);
  const gameOverRef = useRef(false);
  const canRestartRef = useRef(false);
  const scoreRef = useRef(0);
  const [imagesLoaded, setImagesLoaded] = useState(false);
  const [, forceUpdate] = useState({});
  const [imageLoader, setImageLoader] = useState(null);
  const [highScores, setHighScores] = useState({
    easy: 0,
    medium: 0,
    hard: 0
  });
  const [difficulty, setDifficulty] = useState('hard');

  useEffect(() => {
    // Load high scores for all difficulties from cookies when component mounts
    const difficulties = ['easy', 'medium', 'hard'];
    const loadedHighScores = {};
    difficulties.forEach(diff => {
      const savedHighScore = getCookie(`highScore_${diff}`);
      if (savedHighScore) {
        loadedHighScores[diff] = parseInt(savedHighScore, 10);
      } else {
        loadedHighScores[diff] = 0;
      }
    });
    setHighScores(loadedHighScores);
  }, []);

  useEffect(() => {
    const loader = new ImageLoader();
    loader.load({
      birdSprite: `${process.env.PUBLIC_URL}/bird-sprite.png`,
      pipe: `${process.env.PUBLIC_URL}/pipe.png`,
      background: `${process.env.PUBLIC_URL}/background.png`
    }).then(() => {
      setImageLoader(loader);
      setImagesLoaded(true);
    }).catch(error => {
      console.error('Error loading images:', error);
      setImagesLoaded(false);
    });
  }, []);

  const resetGame = useCallback(() => {
    birdRef.current = { x: 50, y: 200, velocity: 0, frame: 0 };
    pipesRef.current = [];
    frameCountRef.current = 0;
    gameOverRef.current = false;
    canRestartRef.current = false;
    scoreRef.current = 0;
    forceUpdate({});
  }, []);

  const jump = useCallback(() => {
    if (!gameOverRef.current) {
      birdRef.current.velocity = JUMP_STRENGTH;
    } else if (canRestartRef.current) {
      resetGame();
    }
  }, [resetGame]);

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.code === 'Space') {
        jump();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, [jump]);

  // Remove this function
  // const handleCanvasClick = () => {
  //   jump();
  // };

  const getDifficultySettings = useCallback(() => {
    switch (difficulty) {
      case 'easy':
        return { gap: PIPE_GAP_EASY };
      case 'medium':
        return { gap: PIPE_GAP_MEDIUM };
      case 'hard':
      default:
        return { gap: PIPE_GAP_HARD };
    }
  }, [difficulty]);

  const generatePipe = useCallback(() => {
    const canvasHeight = canvasRef.current.height;
    const { gap } = getDifficultySettings();
    const gapStart = Math.random() * (canvasHeight - gap - 100) + 50; // Ensure some space at top and bottom
    return {
      x: canvasRef.current.width,
      topHeight: gapStart,
      bottomHeight: canvasHeight - gapStart - gap,
      passed: false
    };
  }, [getDifficultySettings]);

  const checkCollision = useCallback(() => {
    const bird = birdRef.current;
    const canvas = canvasRef.current;

    // Check collision with ceiling and ground
    if (bird.y <= 0 || bird.y + BIRD_HEIGHT >= canvas.height) {
      return true;
    }

    // Check collision with pipes
    for (let pipe of pipesRef.current) {
      if (
        bird.x < pipe.x + PIPE_WIDTH &&
        bird.x + BIRD_WIDTH > pipe.x &&
        (bird.y < pipe.topHeight || bird.y + BIRD_HEIGHT > canvas.height - pipe.bottomHeight)
      ) {
        return true;
      }
    }

    return false;
  }, []);

  const update = useCallback(() => {
    if (gameOverRef.current) {
      return;
    }

    const bird = birdRef.current;
    const canvas = canvasRef.current;

    // Update bird velocity and position
    bird.velocity += GRAVITY;
    bird.velocity = Math.min(Math.max(bird.velocity, -MAX_VELOCITY), MAX_VELOCITY);
    bird.y += bird.velocity;

    // Keep the bird within the canvas
    bird.y = Math.max(0, Math.min(bird.y, canvas.height - BIRD_HEIGHT));

    // Update bird animation frame
    bird.frame = Math.floor(frameCountRef.current / FRAME_DELAY) % BIRD_FRAMES;

    // Update pipes
    frameCountRef.current++;
    if (frameCountRef.current % PIPE_INTERVAL === 0) {
      pipesRef.current.push(generatePipe());
    }

    pipesRef.current = pipesRef.current.filter(pipe => pipe.x + PIPE_WIDTH > 0);
    pipesRef.current.forEach(pipe => {
      pipe.x -= PIPE_SPEED;

      // Check if bird has passed the pipe
      if (!pipe.passed && pipe.x + PIPE_WIDTH < bird.x) {
        pipe.passed = true;
        scoreRef.current += 1;
      }
    });

    // Check for collisions
    if (checkCollision()) {
      gameOverRef.current = true;
      
      // Update high score for the current difficulty
      if (scoreRef.current > highScores[difficulty]) {
        const newHighScores = { ...highScores, [difficulty]: scoreRef.current };
        setHighScores(newHighScores);
        setCookie(`highScore_${difficulty}`, scoreRef.current, 365); // Store for 1 year
      }
      
      setTimeout(() => {
        canRestartRef.current = true;
        forceUpdate({});
      }, 200);
    }

    forceUpdate({});
  }, [checkCollision, generatePipe, forceUpdate, highScores, difficulty]);

  const drawRotatedImage = useCallback((context, image, x, y, width, height, rotation) => {
    context.save();
    context.translate(x + width / 2, y + height / 2);
    context.rotate(rotation);
    context.drawImage(image, -width / 2, -height / 2, width, height);
    context.restore();
  }, []);

  const draw = useCallback((context) => {
    if (!imagesLoaded || !imageLoader) {
      return;
    }

    context.clearRect(0, 0, context.canvas.width, context.canvas.height);

    // Draw background
    const backgroundImage = imageLoader.getImage('background');
    if (backgroundImage && backgroundImage.complete) {
      context.drawImage(backgroundImage, 0, 0, context.canvas.width, context.canvas.height);
    }

    // Draw pipes
    const pipeImage = imageLoader.getImage('pipe');
    if (pipeImage && pipeImage.complete) {
      pipesRef.current.forEach(pipe => {
        // Draw top pipe
        context.save();
        context.scale(1, -1);
        context.drawImage(pipeImage, pipe.x, -pipe.topHeight, PIPE_WIDTH, pipe.topHeight);
        context.restore();

        // Draw bottom pipe
        context.drawImage(pipeImage, pipe.x, context.canvas.height - pipe.bottomHeight, PIPE_WIDTH, pipe.bottomHeight);
      });
    }

    // Draw birds
    const bird = birdRef.current;
    const birdSprite = imageLoader.getImage('birdSprite');
    if (birdSprite && birdSprite.complete) {
      const rotation = Math.min(Math.max(bird.velocity * BIRD_ROTATION_FACTOR, -Math.PI / 6), Math.PI / 6);
      drawRotatedImage(
        context,
        birdSprite,
        bird.x, bird.y,
        BIRD_WIDTH, BIRD_HEIGHT,
        rotation,
        bird.frame * BIRD_WIDTH, 0, BIRD_WIDTH, BIRD_HEIGHT
      );
    }

    // Game over overlay and text
    if (gameOverRef.current) {
      // White overlay covering the entire canvas
      context.fillStyle = 'rgba(255, 255, 255, 0.7)'; // 70% opaque white
      context.fillRect(0, 0, context.canvas.width, context.canvas.height);

      const gameOverText = 'Game Over';
      const restartText = 'Press Space to Restart';
      
      // Game Over text
      context.fillStyle = 'black';
      context.font = '48px Arial';
      context.textAlign = 'center';
      context.fillText(gameOverText, context.canvas.width / 2, context.canvas.height / 2 - 20);
      
      if (canRestartRef.current) {
        // Restart text
        context.fillStyle = 'black';
        context.font = '24px Arial';
        context.fillText(restartText, context.canvas.width / 2, context.canvas.height / 2 + 30);
      }
    }

  }, [imagesLoaded, imageLoader, drawRotatedImage, highScores, difficulty]);

  useEffect(() => {
    
    let animationFrameId;
    
    const gameLoop = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      if (!imagesLoaded) {
        animationFrameId = requestAnimationFrame(gameLoop);
        return;
      }
      const context = canvas.getContext('2d');
      
      update();
      draw(context);
      
      animationFrameId = requestAnimationFrame(gameLoop);
    };
    
    gameLoop();
    
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [draw, update, imagesLoaded]);

  const handleDifficultyChange = (newDifficulty) => {
    setDifficulty(newDifficulty);
    resetGame();
  };

  return (
    <div className="flappy-bird-container">
      <div className="difficulty-buttons">
        <button 
          onClick={() => handleDifficultyChange('easy')}
          style={{ textDecoration: difficulty === 'easy' ? 'underline' : 'none' }}
        >
          Easy
        </button>
        <button 
          onClick={() => handleDifficultyChange('medium')}
          style={{ textDecoration: difficulty === 'medium' ? 'underline' : 'none' }}
        >
          Medium
        </button>
        <button 
          onClick={() => handleDifficultyChange('hard')}
          style={{ textDecoration: difficulty === 'hard' ? 'underline' : 'none' }}
        >
          Hard
        </button>
      </div>
      <div className="score">
        Score: {scoreRef.current} | High Score: {highScores[difficulty]}
      </div>
      <canvas 
        ref={canvasRef} 
        width={1200} 
        height={600} 
      />
      {!imagesLoaded && <p>Loading images...</p>}
    </div>
  );
};

// Helper functions for cookie management
function setCookie(name, value, days) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = name + '=' + encodeURIComponent(value) + '; expires=' + expires + '; path=/';
}

function getCookie(name) {
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1]) : r;
  }, '');
}

export default FlappyBird;
