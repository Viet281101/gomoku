import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { findBestMoveMinimaxAlphaBeta } from './MinimaxAlphaBeta';
import { mcts } from './MCTS';

interface CustomBoardProps {
	boardSize: number;
	player1: string;
	player2: string;
}

const CustomBoard: React.FC<CustomBoardProps> = ({ boardSize, player1, player2 }) => {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const [board, setBoard] = useState<string[][]>(Array(boardSize).fill(null).map(() => Array(boardSize).fill('')));
	const [currentTurn, setCurrentTurn] = useState<'black' | 'white'>('black');
	const [winner, setWinner] = useState<string | null>(null);
	const [showWinnerPopup, setShowWinnerPopup] = useState<boolean>(false);
	const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number } | null>(null);
	const [moveHistory, setMoveHistory] = useState<{ x: number, y: number, player: string }[]>([]);
	const [canvasSize, setCanvasSize] = useState(600);
	const navigate = useNavigate();

	useEffect(() => {
		const updateCanvasSize = () => {
			const screenWidth = window.innerWidth;
			const screenHeight = window.innerHeight;
			const size = Math.min(screenWidth, screenHeight) * (screenWidth < 768 ? 1 : 0.8);
			setCanvasSize(size);
		};

		updateCanvasSize();
		window.addEventListener('resize', updateCanvasSize);
		return () => window.removeEventListener('resize', updateCanvasSize);
	}, []);

	useEffect(() => {
		const canvas = canvasRef.current;
		if (canvas) {
			const ctx = canvas.getContext('2d');
			if (ctx) {
				const cellSize = canvasSize / (boardSize + 1);

				const drawBoard = () => {
					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.fillStyle = '#D2B48C';
					ctx.fillRect(0, 0, canvas.width, canvas.height);

					ctx.strokeStyle = '#000000';
					for (let i = 1; i <= boardSize; i++) {
						ctx.beginPath();
						ctx.moveTo(cellSize, i * cellSize);
						ctx.lineTo(boardSize * cellSize, i * cellSize);
						ctx.stroke();

						ctx.beginPath();
						ctx.moveTo(i * cellSize, cellSize);
						ctx.lineTo(i * cellSize, boardSize * cellSize);
						ctx.stroke();
					}
				};

				const drawPieces = () => {
					board.forEach((row, y) => {
						row.forEach((cell, x) => {
							if (cell !== '') {
								ctx.beginPath();
								ctx.arc((x + 1) * cellSize, (y + 1) * cellSize, cellSize / 2.4, 0, 2 * Math.PI);
								ctx.fillStyle = cell === 'X' ? 'black' : 'white';
								ctx.fill();
								ctx.stroke();

								const moveIndex = moveHistory.findIndex(move => move.x === x && move.y === y);
								if (moveIndex !== -1) {
									ctx.fillStyle = cell === 'X' ? 'white' : 'black';
									ctx.font = `${cellSize / 2.5}px Arial`;
									ctx.textAlign = 'center';
									ctx.textBaseline = 'middle';
									ctx.fillText((moveIndex + 1).toString(), (x + 1) * cellSize, (y + 1) * cellSize);
								}
							}
						});
					});
				};

				const drawHoverPiece = () => {
					if (hoveredCell && !winner && board[hoveredCell.y][hoveredCell.x] === '') {
						ctx.beginPath();
						ctx.arc(
							(hoveredCell.x + 1) * cellSize,
							(hoveredCell.y + 1) * cellSize,
							cellSize / 2.4,
							0,
							2 * Math.PI
						);
						ctx.fillStyle = currentTurn === 'black' ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';
						ctx.fill();
						ctx.stroke();
					}
				};

				drawBoard();
				drawPieces();
				drawHoverPiece();
			}
		}
	}, [board, boardSize, hoveredCell, currentTurn, winner, moveHistory, canvasSize]);

	useEffect(() => {
		const makeAIMove = async () => {
			if ((currentTurn === 'black' && player1 !== 'Human') || (currentTurn === 'white' && player2 !== 'Human')) {
				const aiMove = await getAIMove();
				if (aiMove) {
					makeMove(aiMove.x, aiMove.y);
				}
			}
		};
		makeAIMove();
	}, [currentTurn]);

	useEffect(() => {
		if (winner) {
			setShowWinnerPopup(true);
		}
	}, [winner]);

	const getAIMove = async () => {
		if (currentTurn === 'black' && player1 !== 'Human') {
			if (player1 === 'Minimax') {
				return new Promise<{ x: number, y: number }>((resolve) => {
					const worker = new Worker(new URL('./minimaxWorker.ts', import.meta.url));
					worker.postMessage({ board, depth: 2, player: 'X' });
					worker.onmessage = (event) => {
						resolve(event.data);
						worker.terminate();
					};
				});
			} else if (player1 === 'Minimax Alphabeta') {
				return findBestMoveMinimaxAlphaBeta(board, 2, 'X');
			} else if (player1 === 'Monte Carlo Tree Search') {
				return mcts(board);
			}
		} else if (currentTurn === 'white' && player2 !== 'Human') {
			if (player2 === 'Minimax') {
				return new Promise<{ x: number, y: number }>((resolve) => {
					const worker = new Worker(new URL('./minimaxWorker.ts', import.meta.url));
					worker.postMessage({ board, depth: 2, player: 'O' });
					worker.onmessage = (event) => {
						resolve(event.data);
						worker.terminate();
					};
				});
			} else if (player2 === 'Minimax Alphabeta') {
				return findBestMoveMinimaxAlphaBeta(board, 2, 'O');
			} else if (player2 === 'Monte Carlo Tree Search') {
				return mcts(board);
			}
		}
		return null;
	};

	const makeMove = (col: number, row: number) => {
		const newBoard = board.map((r, rowIndex) =>
			r.map((cell, colIndex) => (rowIndex === row && colIndex === col ? (currentTurn === 'black' ? 'X' : 'O') : cell))
		);
		setBoard(newBoard);
		const newMoveHistory = [...moveHistory, { x: col, y: row, player: currentTurn }];
		setMoveHistory(newMoveHistory);
		if (checkWinner(newBoard, currentTurn === 'black' ? 'X' : 'O', row, col)) {
			setWinner(currentTurn);
		} else {
			setCurrentTurn(currentTurn === 'black' ? 'white' : 'black');
		}
	};

	const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
		if (winner) return;

		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const cellSize = canvasSize / (boardSize + 1);
		const col = Math.floor(x / cellSize) - 1;
		const row = Math.floor(y / cellSize) - 1;

		if (col >= 0 && col < boardSize && row >= 0 && row < boardSize && board[row][col] === '' && ((currentTurn === 'black' && player1 === 'Human') || (currentTurn === 'white' && player2 === 'Human'))) {
			makeMove(col, row);
		}
	};

	const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
		const canvas = canvasRef.current;
		if (!canvas) return;

		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;

		const cellSize = canvasSize / (boardSize + 1);
		const col = Math.floor(x / cellSize) - 1;
		const row = Math.floor(y / cellSize) - 1;

		if (col >= 0 && col < boardSize && row >= 0 && row < boardSize) {
			setHoveredCell({ x: col, y: row });
		} else {
			setHoveredCell(null);
		}
	};

	const handleMouseOut = () => {
		setHoveredCell(null);
	};

	const checkWinner = (board: string[][], player: string, row: number, col: number): boolean => {
		const directions = [
			{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 1, y: -1 }
		];

		const countConsecutive = (dx: number, dy: number): number => {
			let count = 0;
			for (let i = -4; i <= 4; i++) {
				const x = col + i * dx;
				const y = row + i * dy;
				if (x >= 0 && x < boardSize && y >= 0 && y < boardSize && board[y][x] === player) {
					count++;
					if (count === 5) return count;
				} else {
					count = 0;
				}
			}
			return count;
		};

		for (const { x, y } of directions) {
			if (countConsecutive(x, y) >= 5) return true;
		}
		return false;
	};

	const handleQuit = () => {
		navigate('/');
	};

	const handleClose = () => {
		setShowWinnerPopup(false);
	};

	const handleSave = () => {
		const canvas = canvasRef.current;
		if (canvas) {
			const link = document.createElement('a');
			link.href = canvas.toDataURL('image/png');
			link.download = 'gomoku_board.png';
			link.click();
		}
	};

	return (
		<div className="flex flex-col justify-center items-center min-h-screen">
			<h2 className="text-2xl font-bold mb-4">
				{currentTurn === 'black' ? "Black" : "White"}'s Turn
			</h2>
			<canvas
				ref={canvasRef}
				width={canvasSize}
				height={canvasSize}
				onClick={handleCanvasClick}
				onMouseMove={handleMouseMove}
				onMouseOut={handleMouseOut}
				className="border border-black shadow-md"
			></canvas>
			{showWinnerPopup && winner && (
				<div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
					<div className="bg-white p-8 rounded shadow-md text-center">
						<p className="text-xl font-semibold mb-4">{winner.toUpperCase()} wins!</p>
						<p className="text-md mb-4">Total Moves: {moveHistory.length}</p>
						<div className="flex justify-center space-x-4">
							<button
								onClick={handleClose}
								className="px-4 py-2 bg-gray-600 text-white font-semibold rounded-md shadow-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-transform transform hover:scale-105"
							>
								Close
							</button>
							<button
								onClick={handleSave}
								className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-md shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-transform transform hover:scale-105"
							>
								Save
							</button>
							<button
								onClick={handleQuit}
								className="px-4 py-2 bg-red-600 text-white font-semibold rounded-md shadow-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-transform transform hover:scale-105"
							>
								Quit
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default CustomBoard;
