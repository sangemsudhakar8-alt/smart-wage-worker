import { db } from '../config/firebaseAdmin.js';

export const handleSession = async (req, res) => {
  const { uid } = req.user;
  const { role, phone } = req.body;

  try {
    const userRef = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      const newUser = {
        id: uid,
        phone: phone || req.user.phone || '',
        role: role || 'worker',
        name: `User ${(phone || req.user.phone || uid).slice(-4)}`,
        skills: [],
        location: '',
        trustScore: 100,
        badges: [],
        createdAt: new Date().toISOString()
      };
      await userRef.set(newUser);
      return res.json({ user: newUser });
    } else {
      const existingData = userSnap.data();
      // Ensure the ID is present in the object returned
      if (!existingData.id) {
        existingData.id = uid;
      }
      if (role && existingData.role !== role) {
        await userRef.update({ role });
        return res.json({ user: { ...existingData, role } });
      }
      return res.json({ user: existingData });
    }
  } catch (error) {
    console.error('Error in handleSession:', error);
    return res.status(500).json({ error: 'Server error processing session' });
  }
};

export const getProfile = async (req, res) => {
  const { uid } = req.user;
  try {
    const userSnap = await db.collection('users').doc(uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }
    const data = userSnap.data();
    if (!data.id) data.id = uid;
    return res.json(data);
  } catch (error) {
    console.error('Error in getProfile:', error);
    return res.status(500).json({ error: 'Server error fetching profile' });
  }
};

export const updateProfile = async (req, res) => {
  const { uid } = req.user;
  const { name, skills, location, photoURL } = req.body;

  try {
    const userRef = db.collection('users').doc(uid);
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (skills !== undefined) updateData.skills = skills;
    if (location !== undefined) updateData.location = location;
    if (photoURL !== undefined) updateData.photoURL = photoURL;

    await userRef.update(updateData);
    const updatedSnap = await userRef.get();
    const data = updatedSnap.data();
    if (!data.id) data.id = uid;
    return res.json(data);
  } catch (error) {
    console.error('Error in updateProfile:', error);
    return res.status(500).json({ error: 'Server error updating profile' });
  }
};
