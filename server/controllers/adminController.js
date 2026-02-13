import Job from '../models/Job.js';
import User from '../models/User.js';

//Jobs for Admin Dashboard
export async function getAllJobs(req, res) {
    try {
        const jobs = await Job.find();
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({message: "Failed to load Job Listings."});
    }
}

export async function getAllAvailableJobs (req, res) {
    try {
        const jobs = await Job.find({status: 'Available'});
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({message: "Failed to load Available Jobs."});
    }
}

export async function getAllCompletedJobs (req, res) {
    try {
        const jobs = await Job.find({status: 'Completed'});
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({message: "Failed to load Completed Jobs."});
    }
}

export async function getAllInProgressJobs (req, res) {
    try {
        const jobs = await Job.find({status: 'In Progress'});
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({message: "Failed to load In Progress Jobs."});
    }
}

export async function getAllCancelledJobs (req, res) {
    try {
        const jobs = await Job.find({status: 'Cancelled'});
        res.status(200).json(jobs);
    } catch (error) {
        res.status(500).json({message: "Failed to load Cancelled Jobs."});
    }
}

export async function getJobDetails(req, res) {
    try {
        const {id} = req.params;
        const jobDetails = await Job.findById(id).populate('category', 'name').populate('postedBy', 'firstName lastName email');
        if(!jobDetails) {
            return res.status(404).json({message: "Job not found."});
        }
        res.status(200).json(jobDetails);
    } catch (error) {
        res.status(500).json({message: "Failed to load Job Details."});
    }
}

export async function updateJobDetails(req, res) {
    try {
        const {id} = req.params;
        const {title, description, category, location, salary, status} = req.body;
        const updatedJob = await Job.findByIdAndUpdate(id, {title, description, category, location, salary, status}, {new: true}).populate('category', 'name').populate('postedBy', 'firstName lastName email');  
        res.status(200).json(updatedJob);
    }   catch (error) {
        res.status(500).json({message: "Failed to update Job Details."});
    }
}

//User function for Admin Dashboard

export async function getAllUsers(req, res) {
    try {
        const users = await User.find({role: {$in: ['hire', 'work', 'both']}});
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({message: "Failed to load Users."});
    }
}

export async function getAllWorkers(req, res) {
    try {
        const users = await User.find({role: 'work'});
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({message: "Failed to load Workers."});
    }
}

export async function getAllEmployers(req, res) {
    try {
        const users = await User.find({role: 'hire'});
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({message: "Failed to load Employers."});
    }
}

export async function getBothUsers(req, res) {
    try {
        const users = await User.find({role: 'both'});
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({message: "Failed to load Employers/Workers."});
    }
}
export async function getAllAdmins(req, res) {
    try {
        const users = await User.find({role: 'admin'});
        res.status(200).json(users);
    } catch (error) {
        res.status(500).json({message: "Failed to load Admins."});
    }
}

export async function getUserDetails(req, res) {
    try {
        const {id} = req.params;
        const userDetails = await User.findById(id).select('-passwordHashed');
        if(!userDetails) {
            return res.status(404).json({message: "User not found."});
        }
        res.status(200).json(userDetails);
    } catch (error) {
        res.status(500).json({message: "Failed to load User Details."});
    }
}    

export async function patchUserDetails(req, res) {
    try {
        const {id} = req.params;
        const {firstName, lastName, email, address, city, phoneNumber, province, companyName, jobPosition, role} = req.body;
        const updatedUser = await User.findByIdAndUpdate(id, {firstName, lastName, email, address, city, phoneNumber, province, companyName, jobPosition, role}, {new: true}).select('-passwordHashed');  
        res.status(200).json(updatedUser);
    } catch (error) {
        res.status(500).json({message: "Failed to update User Details."});
    }
}

//Analytics stuff
export async function getWorkersCount(req, res) {
    try {
        const count = await User.countDocuments({role: 'work'});
        res.status(200).json({count});
    } catch (error) {
        res.status(500).json({message: "Failed to load Workers Count."});
    }
}

export async function getEmployersCount(req, res) {
    try {
        const count = await User.countDocuments({role: 'hire'});
        res.status(200).json({count});
    } catch (error) {
        res.status(500).json({message: "Failed to load Employers Count."});
    }
}

export async function getJobsCount(req, res) {
    try {
        const count = await Job.countDocuments();
        res.status(200).json({count});
    } catch (error) {
        res.status(500).json({message: "Failed to load Jobs Count."});
    }
}

export async function getAvailableJobsCount(req, res) {
    try {
        const count = await Job.countDocuments({status: 'Available'});
        res.status(200).json({count});
    } catch (error) {
        res.status(500).json({message: "Failed to load Available Jobs Count."});
    }
}

export async function getInProgressJobsCount(req, res) {
    try {
        const count = await Job.countDocuments({status: 'In Progress'});
        res.status(200).json({count});
    } catch (error) {
        res.status(500).json({message: "Failed to load In Progress Jobs Count."});
    }
}

export async function getCancelledJobsCount(req, res) {
    try {
        const count = await Job.countDocuments({status: 'Cancelled'});
        res.status(200).json({count});
    } catch (error) {
        res.status(500).json({message: "Failed to load Cancelled Jobs Count."});
    }
}

export async function getCompletedJobsCount(req, res) {
    try {
        const count = await Job.countDocuments({status: 'Completed'});
        res.status(200).json({count});
    } catch (error) {
        res.status(500).json({message: "Failed to load Completed Jobs Count."});
    }
}

