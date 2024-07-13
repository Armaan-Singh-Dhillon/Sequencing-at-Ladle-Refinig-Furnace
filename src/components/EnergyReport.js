import React, { useState, useEffect } from 'react';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import styled from 'styled-components';

const StopReport = ({ dataEmit }) => {
    const [data, setData] = useState(() => {
        const savedData = localStorage.getItem('realTimeTableData');
        return savedData ? JSON.parse(savedData) : [];
    });
    const [textInputs, setTextInputs] = useState({});
    const [editing, setEditing] = useState({});

    useEffect(() => {
        localStorage.setItem('realTimeTableData', JSON.stringify(data));
    }, [data]);

    useEffect(() => {
        const existingEntryIndex = data.findIndex(item => item.id === dataEmit.track_id);
        if (existingEntryIndex !== -1) {
            setData(prevData => {
                const updatedData = [...prevData];
                updatedData[existingEntryIndex] = {
                    ...updatedData[existingEntryIndex],
                    total_time: dataEmit.total_time,
                    energyConsumed: calculateEnergyConsumed(dataEmit.total_time)
                };
                return updatedData;
            });
        } else {
            const newDataObject = {
                id: dataEmit.track_id,
                heat: '',
                energyConsumed: calculateEnergyConsumed(dataEmit.total_time),
                date: new Date().toLocaleDateString(),
                total_time: dataEmit.total_time
            };
            setData(prevData => [...prevData, newDataObject]);
        }
    }, [dataEmit]);

    const handleText = (e, id) => {
        setTextInputs({
            ...textInputs,
            [id]: e.target.value
        });
    };

    const handleClick = (id) => {
        setData(prevData =>
            prevData.map(item =>
                item.id === id ? { ...item, heat: textInputs[id] || '' } : item
            )
        );
        setEditing({ ...editing, [id]: false });
    };

    const handleEdit = (id) => {
        setEditing({ ...editing, [id]: true });
        setTextInputs({ ...textInputs, [id]: data.find(item => item.id === id).heat });
    };

    const handleClearData = () => {
        setData([]);
        setTextInputs({});
        setEditing({});
    };

    const calculateEnergyConsumed = (totalTime) => {
        const energy = totalTime * 370; // Assuming power is given in watts per minute
        return energy.toFixed(2); // Adjust precision as needed
    };

    const exportToExcel = async () => {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sheet1');

        worksheet.columns = [
            { header: 'S.No', key: 'serial', width: 10 },
            { header: 'ID', key: 'id', width: 32 },
            { header: 'Date', key: 'date', width: 15 },
            { header: 'Time', key: 'time', width: 15 },
            { header: 'Heat', key: 'heat', width: 50 },
            { header: 'Energy Consumed', key: 'energyConsumed', width: 50 }
        ];

        data.forEach((item, index) => {
            const energy = calculateEnergyConsumed(item.total_time);
            worksheet.addRow({
                serial: index + 1,
                id: item.id,
                date: item.date,
                time: item.total_time,
                heat: item.heat,
                energyConsumed: item.energyConsumed
            });
        });

        worksheet.eachRow({ includeEmpty: true }, function (row, rowNumber) {
            row.eachCell({ includeEmpty: true }, function (cell, colNumber) {
                cell.font = { name: 'Arial', size: 12 };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };

                if (rowNumber === 1) {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFF00' }
                    };
                }
            });
        });

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/octet-stream" });
        saveAs(blob, "data.xlsx");
    };

    return (
        <Wrapper>
            <div className='table'>
                <div className='cell serial'>S.No</div>
                <div className='cell id'>ID</div>
                <div className='cell date'>Date</div>
                <div className='cell time'>Total Time</div>
                <div className='cell heat'>Heat No.</div>
                <div className='cell energy'>Power Consumed</div>
                {data.map((el, index) => (
                    <React.Fragment key={el.id}>
                        <div className='cell serial'>{index + 1}</div>
                        <div className='cell id'>{el.id}</div>
                        <div className='cell date'>{el.date}</div>
                        <div className='cell time'>{el.total_time} s</div>
                        <div className='cell heat'>
                            {editing[el.id] ? (
                                <div className='edit'>
                                    <input
                                        type="text"
                                        onChange={(e) => handleText(e, el.id)}
                                        value={textInputs[el.id] || ''}
                                        placeholder="Edit heat"
                                    />
                                    <div>
                                        <button onClick={() => handleClick(el.id)}>Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className='edit'>
                                    <div className='text'>{el.heat}</div>
                                    <div>
                                        <button onClick={() => handleEdit(el.id)}>Add/Edit</button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className='cell energy'>{el.energyConsumed} Kw</div>
                    </React.Fragment>
                ))}
            </div>
            <div className="buttons">
                <button onClick={exportToExcel}>Export to Excel</button>
                <button onClick={handleClearData}>Clear Data</button>
            </div>
        </Wrapper>
    );
};

const Wrapper = styled.div`
    color: #4deeea;
    background-color: #0e254a;
    .edit {
        display: flex;
        flex-direction: column;
    }

    .buttons button {
        padding: 0.3rem;
    }

    .table {
        display: grid;
        grid-template-columns: 0.1fr 0.3fr 0.4fr 0.4fr 0.4fr 0.8fr;
        gap: 3.5px;
        border: 1px solid #ccc;
        max-height: 65vh;
        overflow-y: auto;
    }

    .cell {
        padding: 10px;
        border: 1px solid #ccc;
        white-space: normal;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .cell.serial { grid-column: 1/2; }
    .cell.id { grid-column: 2/3; }
    .cell.date { grid-column: 3/4; color: #82ca9d; }
    .cell.time { grid-column: 4/5; color: #8884d8; }
    .cell.heat { grid-column: 5/6; display: flex; flex-direction: column; justify-content: space-evenly; }
    .cell.energy { grid-column: 6/7; display: flex; flex-direction: column; justify-content: space-evenly; }

    .edit {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }

    .text {
        word-wrap: break-word;
        overflow-wrap: break-word;
        white-space: pre-wrap;
    }

    input {
        width: 100%;
        padding: 0.3rem;
    }

    input:focus {
        outline: none;
    }
`;

export default StopReport;
