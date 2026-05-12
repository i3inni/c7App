import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            'AIzaSyA7Yt6Ap1Gzr__gdCcZ5PDbP5SouVRyKb8',
  authDomain:        'care-full-3d5e9.firebaseapp.com',
  projectId:         'care-full-3d5e9',
  storageBucket:     'care-full-3d5e9.firebasestorage.app',
  messagingSenderId: '1049899981613',
  appId:             '1:1049899981613:android:791dbb6f06223a298151a4',
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

const DEVICE_ID = 'b4bfe906b764';
const USER_ID   = 'Lgp9M1wjdIM8nAEoNRfnf3rs6mn1';

// 20대 한국 남성 평균 기준
// 키: 174cm, 몸무게: 70kg, 나이: 23
// baseline: 벽에 기댄 바른 자세 기준 각도 (C7, T7, T3)
const calibration = {
  baseline_pitch: [5.0, 10.0, 7.0],   // [C7, T7, T3] 바른 자세 피치
  baseline_roll:  [0.0,  0.0, 0.0],   // [C7, T7, T3] 바른 자세 롤
  height_cm:      174,
  weight_kg:      70,
  age:            23,
  bmi:            23.1,
};

const ref = doc(db, 'devices', DEVICE_ID, 'calibrations', USER_ID);
await setDoc(ref, calibration);

console.log('✅ 캘리브레이션 저장 완료');
console.log(`   경로: devices/${DEVICE_ID}/calibrations/${USER_ID}`);
console.log('   데이터:', JSON.stringify(calibration, null, 2));
process.exit(0);
