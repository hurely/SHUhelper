import {ObjectID} from "mongodb";
import {createDate} from "../../../shared/tools/date";
import {mongodb} from "../infrastructure/mongodb";
import {redis} from "../infrastructure/redis";
import * as fs from "fs";

export class DateRange {
    constructor(public begin: Date, public end: Date) {
    }

    get isNowIn() {
        return this.isDateIn(new Date());
    }

    serialize() {
        return this;
    }

    isDateIn(date: Date) {
        return this.begin <= date && date < this.end;
    }
}

export class Holiday {
    constructor(public name: string,
                public dateRange: DateRange) {
    }

    static fromJson(json: JSON): Holiday {
        return new Holiday(
            json['name'],
            new DateRange(
                createDate(json['begin'][0], json['begin'][1], json['begin'][2]),
                createDate(json['end'][0], json['end'][1], json['end'][2])
            )
        );
    }

    serialize() {
        return {
            name: this.name,
            ...this.dateRange.serialize()
        };
    }
}

export class Semester {
    constructor(
        public _id: ObjectID,
        public name: string,
        public dateRange: DateRange,
        public holidays: Array<Holiday>
    ) {
    }

    static fromJson(json: JSON): Semester {
        return new Semester(
            json['id'],
            json['name'],
            new DateRange(
                createDate(json['begin'][0], json['begin'][1], json['begin'][2]),
                createDate(json['end'][0], json['end'][1], json['end'][2])
            ),
            json['holidays'].map((it: JSON) => Holiday.fromJson(it)));
    }

    static fromRawObject(rawObject) {
        return new Semester(
            rawObject._id,
            rawObject.name,
            new DateRange(rawObject['begin'], rawObject['end']),
            rawObject.holidays.map(it => {
                return new Holiday(it.name, new DateRange(it['begin'], it['end']))
            })
        );
    }

    serialize() {
        return {
            _id: this._id,
            name: this.name,
            ...this.dateRange.serialize(),
            holidays: this.holidays.map((it: Holiday) => it.serialize())
        }
    }
}

export namespace SemesterRepository {
    let currentSemester: Semester = null;

    export async function getById(id: ObjectID | string): Promise<Semester | null> {
        if (typeof id === 'string') {
            id = new ObjectID(id);
        }
        let objectInBuffer = await redis.get('semester_' + id);
        if (objectInBuffer !== null) {
            return Semester.fromJson(JSON.parse(objectInBuffer));
        }
        const rawObject = await mongodb.collection('semester').findOne({id: id});
        if (rawObject === null)
            return null;
        return Semester.fromRawObject(rawObject);
    }

    export async function getByName(name: string): Promise<Semester | null> {
        const rawObject = await mongodb.collection('semester').findOne({name: name});
        if (rawObject === null)
            return null;
        return Semester.fromRawObject(rawObject);
    }

    export async function current(): Promise<Semester | null> {
        if (currentSemester === null || !currentSemester.dateRange.isNowIn) {
            const now = new Date();
            const rawObject = await mongodb.collection('semester').findOne({
                begin: {$lte: now},
                end: {$gt: now}
            });
            currentSemester = Semester.fromRawObject(rawObject);
        }
        return currentSemester;
    }

    export async function save(object: Semester) {
        let data = JSON.stringify(await object.serialize());
        await redis.set('semester_' + object._id, data);
        await mongodb.collection('semester').insertOne(object.serialize());
    }
}

/**
 * 这个函数是临时的
 * 在管理员后台准备好之前将会使用json文件来初始化
 */
export async function initSemesters() {
    const data = fs.readFileSync('./initialData/semester.json');
    const json = JSON.parse(data.toString());
    for (let semester of json['semester']) {
        if (SemesterRepository.getByName(semester['name']) === null) {
            await SemesterRepository.save(Semester.fromJson(semester));
        }
    }
}