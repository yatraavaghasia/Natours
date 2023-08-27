const mongoose = require('mongoose');
const slugify = require('slugify');

// Connect to your MongoDB
mongoose.connect('mongodb://localhost:27017/your-database', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const Tour = require('./../../models/tourModel'); // Update the path to your tour model

async function populateSlugs() {
    const tours = await Tour.find();

    // eslint-disable-next-line no-restricted-syntax
    for (const tour of tours) {
        tour.slug = slugify(tour.name, { lower: true });
        // eslint-disable-next-line no-await-in-loop
        await tour.save();
    }

    console.log('Slugs populated for all tours.');
    mongoose.disconnect();
}

populateSlugs();
