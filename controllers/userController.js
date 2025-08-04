// controllers/userController.js
import User from '../models/User.js';

// Save or update on login
export const createOrUpdateUser = async (req, res) => {
  const { uid, email, name } = req.user;

  try {
    let user = await User.findOne({ uid });

    if (!user) {
      user = new User({ uid, email, name });
      await user.save();
    } else {
      user.email = email;
      user.name = name;
      await user.save();
    }

    res.status(200).json({ message: 'User saved', user });
  } catch (err) {
    console.error('CreateOrUpdate Error:', err);
    res.status(500).json({ message: 'Error saving user' });
  }
};

// Get profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid });

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user' });
  }
};

// Update profile
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findOneAndUpdate(
      { uid: req.user.uid },
      { $set: req.body },
      { new: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'Profile updated', user });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile' });
  }
};
