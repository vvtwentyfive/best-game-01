// DUNESAIL boot + game loop + screen state machine. Input is read every
// frame, the simulation advances in fixed 1/60 s steps, and the renderer
// paints the world, HUD and the active screen.
//
// ?seed=N fixes the voyage. ?shot=start|play|upgrade|end (with &seed=N)
// stages that scene through the real simulation and paints it for a
// screenshot, setting window.__shotReady when done.
import { ARENA_HEIGHT, ARENA_WIDTH, STEP } from './config.js';
import { createAudio } from './audio.js';
import { createInput, ACTION_START, ACTION_PAUSE, ACTION_MUTE, ACTION_RESTART, ACTION_DASH } from './input.js';
import { loadBestScore, saveBestScore, loadBestLevel, saveBestLevel, loadMutedPreference, saveMutedPreference } from './storage.js';
import { createSession, stepSession, leaveWorkshopToNextRealm, startEndlessVoyage, openLevelUpIfPending } from './session.js';
import { applyUpgradeChoice, rollUpgradeChoices } from './upgrades.js';
import { grantRelic } from './relics.js';
import { buyWorkshopOffer } from './waves.js';
import { drawGameWorld } from './render.js';
import {
  drawHUD, drawTitleScreen, drawPauseScreen, drawLevelUpScreen, drawRelicScreen,
  drawWorkshopScreen, drawVictoryScreen, drawGameOverScreen,
  titleLayout, choiceCardLayout, workshopLayout, endScreenLayout,
} from './hud.js';
import { stageShot } from './shots.js';
import { updateParticles, spawnAmbientSand } from './particles.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const ctx = canvas.getContext('2d');
const audio = createAudio();

function pointInRect(point, rect) {
  return point && point.x >= rect.x && point.x <= rect.x + rect.w && point.y >= rect.y && point.y <= rect.y + rect.h;
}

function runShot(name) {
  const session = createSession(seed, 'sailor', audio, 0);
  stageShot(name, session);
  let painted = 0;
  function paint() {
    drawGameWorld(ctx, session);
    const screen = session.screen;
    if (screen === 'playing' || screen === 'levelup' || screen === 'relic' || screen === 'workshop') {
      drawHUD(ctx, session, false);
    }
    if (screen === 'title') drawTitleScreen(ctx, session, 'sailor', 0, 0);
    else if (screen === 'levelup') drawLevelUpScreen(ctx, session);
    else if (screen === 'relic') drawRelicScreen(ctx, session);
    else if (screen === 'workshop') drawWorkshopScreen(ctx, session);
    else if (screen === 'victory') drawVictoryScreen(ctx, session);
    else if (screen === 'gameover') drawGameOverScreen(ctx, session);
    painted += 1;
    if (painted < 3) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let session = createSession(seed, 'sailor', audio, loadBestScore());
  let selectedDifficulty = 'sailor';
  let best = loadBestScore();
  let bestLevel = loadBestLevel();
  let muted = loadMutedPreference();
  let bombQueued = false;
  let accumulator = 0;
  let last = performance.now();
  let prevScreen = session.screen;
  audio.setMuted(muted);

  function announce(message) {
    status.textContent = message;
  }

  function startRun(difficultyId) {
    const freshSeed = Math.floor(Math.random() * 4294967296);
    session = createSession(freshSeed, difficultyId, audio, best);
    session.screen = 'playing';
    session.realmBannerTimer = 3;
    accumulator = 0;
    audio.unlock();
    audio.startMusic(0);
    announce(`Sailing the Dune Sea on ${difficultyId}. Survive the waves.`);
  }

  function settleRunEnd() {
    if (session.score > best) {
      best = session.score;
      session.isNewBest = true;
      saveBestScore(best);
    }
    if (session.player.level > bestLevel) {
      bestLevel = session.player.level;
      saveBestLevel(bestLevel);
    }
    session.best = best;
  }

  function handleTitleClick(click) {
    const layout = titleLayout();
    for (const slot of layout.difficulties) {
      if (pointInRect(click, slot)) {
        selectedDifficulty = slot.id;
        audio.unlock();
        audio.playClick();
        return;
      }
    }
    if (pointInRect(click, layout.sail)) {
      audio.playClick();
      startRun(selectedDifficulty);
    }
  }

  function handleChoiceClick(click, choices, apply) {
    const rects = choiceCardLayout(choices.length);
    for (let i = 0; i < rects.length; i += 1) {
      if (pointInRect(click, rects[i])) {
        apply(choices[i]);
        audio.playClick();
        return true;
      }
    }
    return false;
  }

  function chooseLevelUp(index) {
    const choice = session.levelUpChoices[index];
    if (!choice) return;
    applyUpgradeChoice(session, choice);
    session.pendingLevels -= 1;
    session.levelUpChoices = [];
    if (session.pendingLevels > 0) {
      // Banked levels chain: roll a fresh set and stay on the choice screen.
      session.levelUpChoices = rollUpgradeChoices(session, 3);
      session.screen = 'levelup';
    } else {
      session.screen = 'playing';
    }
    void openLevelUpIfPending;
    audio.playClick();
  }

  function chooseRelic(index) {
    const choice = session.relicChoices[index];
    if (!choice) return;
    grantRelic(session, choice);
    session.relicChoices = [];
    session.screen = 'playing';
    audio.playClick();
  }

  function handleActions() {
    const actions = input.takeActions();
    const click = input.takeClick();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
      saveMutedPreference(muted);
    }
    if (click) audio.unlock();
    const screen = session.screen;
    if (screen === 'title') {
      const num = input.numberPressed();
      if (num >= 1 && num <= 3) {
        selectedDifficulty = ['drifter', 'sailor', 'sunscorched'][num - 1];
        input.consumeNumber();
      }
      if (click) handleTitleClick(click);
      if (actions & ACTION_START) startRun(selectedDifficulty);
    } else if (screen === 'playing') {
      if (actions & ACTION_PAUSE) {
        session.screen = 'paused';
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startRun(session.difficulty);
      }
    } else if (screen === 'paused') {
      if (actions & ACTION_PAUSE || click || (actions & ACTION_START)) {
        session.screen = 'playing';
        announce('Playing.');
      } else if (actions & ACTION_RESTART) {
        startRun(session.difficulty);
      }
    } else if (screen === 'levelup') {
      const num = input.numberPressed();
      if (num >= 1 && num <= 3) {
        chooseLevelUp(num - 1);
        input.consumeNumber();
      } else if (click) {
        handleChoiceClick(click, session.levelUpChoices, (choice) => {
          chooseLevelUp(session.levelUpChoices.indexOf(choice));
        });
      }
    } else if (screen === 'relic') {
      const num = input.numberPressed();
      if (num >= 1 && num <= 3) {
        chooseRelic(num - 1);
        input.consumeNumber();
      } else if (click) {
        handleChoiceClick(click, session.relicChoices, (choice) => {
          chooseRelic(session.relicChoices.indexOf(choice));
        });
      }
    } else if (screen === 'workshop') {
      if (click) {
        const layout = workshopLayout(session.workshopOffers);
        let bought = false;
        for (let i = 0; i < layout.offers.length; i += 1) {
          if (pointInRect(click, layout.offers[i])) {
            buyWorkshopOffer(session, session.workshopOffers[i]);
            bought = true;
            break;
          }
        }
        if (!bought && pointInRect(click, layout.sail)) {
          audio.playClick();
          leaveWorkshopToNextRealm(session);
          announce(`Entering ${session.realmBanner}.`);
        }
      }
      if (actions & ACTION_START) leaveWorkshopToNextRealm(session);
    } else if (screen === 'victory') {
      if (click) {
        const layout = endScreenLayout(true);
        if (pointInRect(click, layout.restart)) startRun(session.difficulty);
        else if (pointInRect(click, layout.endless)) {
          audio.unlock();
          audio.startMusic(0);
          startEndlessVoyage(session);
        }
      } else if (actions & ACTION_RESTART || actions & ACTION_START) {
        startRun(session.difficulty);
      }
    } else if (screen === 'gameover') {
      if (click) {
        const layout = endScreenLayout(false);
        if (pointInRect(click, layout.restart)) startRun(session.difficulty);
      } else if (actions & ACTION_RESTART || actions & ACTION_START) {
        startRun(session.difficulty);
      }
    }
    if (actions & ACTION_DASH) session.dashQueued = true;
    return actions;
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = handleActions();
    if (session.screen === 'title') {
      session.time += dt;
      spawnAmbientSand(session, dt);
      updateParticles(session, dt);
    } else if (session.screen === 'playing') {
      accumulator += dt;
      const move = input.moveVector();
      const aim = input.aim();
      const firing = input.isFiring();
      while (accumulator >= STEP) {
        const wantsDash = !!session.dashQueued;
        session.dashQueued = false;
        stepSession(session, STEP, { move, aim, firing, dash: wantsDash, bomb: bombQueued });
        bombQueued = false;
        accumulator -= STEP;
        if (session.screen !== 'playing') {
          accumulator = 0;
          break;
        }
      }
      audio.updateMusic(dt);
    }
    if ((session.screen === 'gameover' || session.screen === 'victory') && prevScreen !== session.screen) {
      settleRunEnd();
    }
    prevScreen = session.screen;
    drawGameWorld(ctx, session);
    if (session.screen === 'playing' || session.screen === 'paused' || session.screen === 'levelup' || session.screen === 'relic' || session.screen === 'workshop') {
      drawHUD(ctx, session, muted);
    }
    if (session.screen === 'title') drawTitleScreen(ctx, session, selectedDifficulty, best, bestLevel);
    else if (session.screen === 'paused') drawPauseScreen(ctx, session);
    else if (session.screen === 'levelup') drawLevelUpScreen(ctx, session);
    else if (session.screen === 'relic') drawRelicScreen(ctx, session);
    else if (session.screen === 'workshop') drawWorkshopScreen(ctx, session);
    else if (session.screen === 'victory') drawVictoryScreen(ctx, session);
    else if (session.screen === 'gameover') drawGameOverScreen(ctx, session);
    void actions;
  }

  // Bomb key: queued from its own listener so holding it never repeats.
  window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() === 'b' && !event.repeat) bombQueued = true;
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && session.screen === 'playing') {
      session.screen = 'paused';
      announce('Paused.');
    }
  });

  announce('DUNESAIL. Choose a voyage and set sail.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
