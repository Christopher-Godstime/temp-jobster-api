const Job = require("../models/Job");
const { StatusCodes } = require("http-status-codes");
const { BadRequestError, NotFoundError } = require("../errors");
const mongoose = require("mongoose");
const moment = require("moment");

const getAllJobs = async (req, res) => {
  // getting the search parameters from req.query that is the url
  const { search, status, jobType, sort } = req.query;
  // this means the quertObject should be that of the user where the createdBy in the jobs matches req.user.userId
  const queryObject = {
    createdBy: req.user.userId,
  };

  // this is to search for the job positions aphabetically making use of regex... queryObject.position means search only positions of relating to that queryObject. meaning only search the jobs of the user with that userId(createdBy)
  if (search) {
    queryObject.position = { $regex: search, $options: "i" };
  }

  // this means if jobType is not equal to all (basically all the jobs of the user), bring out only the jobType specified in the url
  if (jobType && jobType !== "all") {
    queryObject.jobType = jobType;
  }

  // this means if job status is not equal to all (basically all the jobs of the user), bring out only the job status specified in the url
  if (status && status !== "all") {
    queryObject.status = status;
  }

  // meaning only display the jobs of the user with that userId
  let result = Job.find(queryObject);

  // these are sorting the jobs using position or date created in an orderly manner
  if (sort === "latest") {
    result = result.sort("-createdAt");
  }
  if (sort === "oldest") {
    result = result.sort("createdAt");
  }
  if (sort === "a-z") {
    result = result.sort("position");
  }
  if (sort === "z-a") {
    result = result.sort("-position");
  }

  // this is for page pagination
  // this means if the page is not provided, it should be page 1
  const page = Number(req.query.page) || 1;
  // limit means how many items per page
  const limit = Number(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  result = result.skip(skip).limit(limit);

  const jobs = await result;

  const totalJobs = await Job.countDocuments(queryObject);
  // this gives total number of pages which is totalJobs / limit
  const numOfPages = Math.ceil(totalJobs / limit);

  res.status(StatusCodes.OK).json({ jobs, totalJobs, numOfPages });
};
const getJob = async (req, res) => {
  const {
    user: { userId },
    params: { id: jobId },
  } = req;

  const job = await Job.findOne({
    _id: jobId,
    createdBy: userId,
  });
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  res.status(StatusCodes.OK).json({ job });
};

const createJob = async (req, res) => {
  req.body.createdBy = req.user.userId;
  const job = await Job.create(req.body);
  res.status(StatusCodes.CREATED).json({ job });
};

const updateJob = async (req, res) => {
  const {
    body: { company, position },
    user: { userId },
    params: { id: jobId },
  } = req;

  if (company === "" || position === "") {
    throw new BadRequestError("Company or Position fields cannot be empty");
  }
  const job = await Job.findByIdAndUpdate(
    { _id: jobId, createdBy: userId },
    req.body,
    { new: true, runValidators: true }
  );
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  res.status(StatusCodes.OK).json({ job });
};

const deleteJob = async (req, res) => {
  const {
    user: { userId },
    params: { id: jobId },
  } = req;

  const job = await Job.findByIdAndRemove({
    _id: jobId,
    createdBy: userId,
  });
  if (!job) {
    throw new NotFoundError(`No job with id ${jobId}`);
  }
  res.status(StatusCodes.OK).send();
};

const showStats = async (req, res) => {
  // aggregator pipeline is used to group data..
  // here the data is being grouped based on the jon status
  let stats = await Job.aggregate([
    // we are matching based on the user id, mongoose.Types.ObjectId is being used because the id is a string
    { $match: { createdBy: mongoose.Types.ObjectId(req.user.userId) } },
    // this is the grouping stage, we want to group it based on the status property which is from the model
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  // this refactors the code to match exactly what the front end is expecting
  stats = stats.reduce((acc, curr) => {
    const { _id: title, count } = curr;
    acc[title] = count;
    return acc;
  }, {});

  // this is when the user dont have any job
  const defaultStats = {
    pending: stats.pending || 0,
    interview: stats.interview || 0,
    declined: stats.declined || 0,
  };

  let monthlyApplications = await Job.aggregate([
    { $match: { createdBy: mongoose.Types.ObjectId(req.user.userId) } },
    // here we are grouping based on year and month
    {
      $group: {
        _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } },
        count: { $sum: 1 },
      },
    },
    // the sort is to make it orderly in ascending order
    { $sort: { "_id.year": -1, "_id.month": -1 } },
    // this limits it to the last 6months
    { $limit: 6 },
  ]);

  // this refactors the above code
  monthlyApplications = monthlyApplications
    .map((item) => {
      const {
        _id: { year, month },
        count,
      } = item;
      // the -1 is added because moment treats months differently
      // format tells how we want it to appear
      const date = moment()
        .month(month - 1)
        .year(year)
        .format("MMM Y");
      // we want to return or show the date or count
      return { date, count };
      // .reverse() makes the dates in order where the latest date will be the last
    })
    .reverse();

  res.status(StatusCodes.OK).json({ defaultStats, monthlyApplications });
};

module.exports = {
  createJob,
  deleteJob,
  getAllJobs,
  updateJob,
  getJob,
  showStats,
};
